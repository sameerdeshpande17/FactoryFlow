(function attachFactoryFlowPlanning(root, factory) {
  const planning = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = planning;
  if (root) root.FactoryFlowPlanning = planning;
})(typeof globalThis === 'undefined' ? this : globalThis, function createFactoryFlowPlanning(root) {
  'use strict';

  const inventory = root && root.FactoryFlowInventory
    ? root.FactoryFlowInventory
    : require('./inventory.js');

  const terminalStatuses = new Set(['Delivered', 'QC review', 'Cancelled']);

  function activeJobs(jobs) {
    return (Array.isArray(jobs) ? jobs : []).filter((job) => job && !terminalStatuses.has(job.status));
  }

  function upsertRequirement(requirements, jobs, materials, input) {
    if (!Array.isArray(requirements)) throw new TypeError('Requirements must be an array.');
    const job = (Array.isArray(jobs) ? jobs : []).find((item) => item.id === input.jobId);
    if (!job || terminalStatuses.has(job.status)) {
      throw new Error('Choose a job that is still active.');
    }

    const material = (Array.isArray(materials) ? materials : []).find((item) => item.sku === input.materialSku);
    if (!material) throw new Error('Choose a material that exists in inventory.');

    const quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Required quantity must be a number greater than zero.');
    }

    const requestedUnit = inventory.normalizeUnit(input.unit);
    const current = inventory.parseQuantity(material.onHand);
    if (!requestedUnit) throw new Error('Enter a unit such as kg, sheets, or rolls.');
    if (!current) throw new Error('Current stock for ' + material.item + ' has an invalid quantity.');
    if (requestedUnit !== current.unit) {
      throw new Error('Unit mismatch for ' + material.item + ': inventory is recorded in ' + current.unitLabel + '. Use the same unit for the requirement.');
    }

    const now = input.updatedAt || new Date().toISOString();
    const existing = requirements.find((item) => item.jobId === job.id && item.materialSku === material.sku);
    if (existing) {
      const previousQuantity = existing.quantity;
      existing.quantity = quantity;
      existing.unit = current.unitLabel;
      existing.material = material.item;
      existing.updatedAt = now;
      return { requirement: existing, updated: true, previousQuantity };
    }

    const requirement = {
      id: 'RQ-' + (101 + requirements.length),
      jobId: job.id,
      materialSku: material.sku,
      material: material.item,
      quantity,
      unit: current.unitLabel,
      createdAt: now,
      updatedAt: now
    };
    requirements.push(requirement);
    return { requirement, updated: false, previousQuantity: null };
  }

  function calculatePlan(jobs, requirements, materials, purchases, movements) {
    const active = activeJobs(jobs);
    const activeIds = new Set(active.map((job) => job.id));
    const materialBySku = new Map((Array.isArray(materials) ? materials : []).map((item) => [item.sku, item]));
    const jobById = new Map(active.map((job) => [job.id, job]));
    const totals = new Map();
    const jobRequirements = [];
    const issues = [];

    (Array.isArray(requirements) ? requirements : []).forEach((requirement) => {
      if (!activeIds.has(requirement.jobId)) return;
      const job = jobById.get(requirement.jobId);
      const material = materialBySku.get(requirement.materialSku);
      if (!material) {
        issues.push({ requirementId: requirement.id, jobId: job.id, message: 'Material ' + requirement.materialSku + ' is missing from inventory.' });
        return;
      }

      const required = Number(requirement.quantity);
      const requestedUnit = inventory.normalizeUnit(requirement.unit);
      const stock = inventory.parseQuantity(material.onHand);
      if (!Number.isFinite(required) || required <= 0 || !stock) {
        issues.push({ requirementId: requirement.id, jobId: job.id, message: 'Invalid quantity or stock record for ' + material.item + '.' });
        return;
      }
      if (requestedUnit !== stock.unit) {
        issues.push({ requirementId: requirement.id, jobId: job.id, message: 'Unit mismatch for ' + material.item + ' on ' + job.id + '.' });
        return;
      }

      const consumedMovements = (Array.isArray(movements) ? movements : []).filter((movement) =>
        movement && movement.jobId === job.id && movement.materialSku === material.sku &&
        (movement.type === 'Consumption' || movement.direction === 'OUT')
      );
      let consumedQty = 0;
      consumedMovements.forEach((movement) => {
        if (inventory.normalizeUnit(movement.unit) !== stock.unit) {
          issues.push({ requirementId: requirement.id, jobId: job.id, message: 'Consumption unit mismatch for ' + material.item + ' on ' + job.id + '.' });
          return;
        }
        const used = Number(movement.quantity);
        if (Number.isFinite(used) && used > 0) consumedQty += used;
      });
      consumedQty = Math.round(consumedQty * 10000) / 10000;
      const remainingQty = Math.max(0, required - consumedQty);

      jobRequirements.push({
        id: requirement.id,
        jobId: job.id,
        job: job.item,
        customer: job.customer,
        materialSku: material.sku,
        material: material.item,
        quantity: required,
        consumedQty,
        remainingQty,
        unit: stock.unitLabel
      });

      let total = totals.get(material.sku);
      if (!total) {
        total = {
          materialSku: material.sku,
          material: material.item,
          unit: stock.unitLabel,
          requiredQty: 0,
          plannedQty: 0,
          consumedQty: 0,
          availableQty: stock.quantity,
          incomingQty: 0,
          unitCost: material.unitCost !== null && material.unitCost !== undefined && material.unitCost !== '' && Number.isFinite(Number(material.unitCost)) && Number(material.unitCost) >= 0 ? Number(material.unitCost) : null,
          jobCount: 0,
          jobIds: []
        };
        totals.set(material.sku, total);
      }
      total.plannedQty += required;
      total.consumedQty += consumedQty;
      total.requiredQty += remainingQty;
      if (!total.jobIds.includes(job.id)) {
        total.jobIds.push(job.id);
        total.jobCount += 1;
      }
    });

    (Array.isArray(purchases) ? purchases : []).forEach((purchase) => {
      if (!purchase || !['Confirmed', 'In transit', 'Part received'].includes(purchase.status)) return;
      const material = (Array.isArray(materials) ? materials : []).find((item) =>
        item.sku === purchase.materialSku ||
        (item.item && purchase.material && item.item.trim().toLocaleLowerCase() === purchase.material.trim().toLocaleLowerCase())
      );
      if (!material) return;
      const ordered = Number(purchase.quantity);
      if (!Number.isFinite(ordered) || ordered <= 0) return;
      const received = Number(purchase.receivedQty || 0);
      const openQuantity = Math.max(0, ordered - (Number.isFinite(received) ? received : 0));
      const stock = inventory.parseQuantity(material.onHand);
      if (!stock || inventory.normalizeUnit(purchase.unit) !== stock.unit) return;
      const total = totals.get(material.sku);
      if (total) total.incomingQty += openQuantity;
    });

    const byMaterial = [...totals.values()].map((item) => {
      const projectedAvailableQty = item.availableQty + item.incomingQty;
      const shortageQty = Math.max(0, item.requiredQty - projectedAvailableQty);
      const coveragePercent = item.requiredQty > 0
        ? Math.min(100, Math.round((projectedAvailableQty / item.requiredQty) * 10000) / 100)
        : 100;
      const estimatedShortageCost = item.unitCost === null
        ? null
        : Math.round(shortageQty * item.unitCost * 100) / 100;
      return {
        ...item,
        projectedAvailableQty: Math.round(projectedAvailableQty * 10000) / 10000,
        requiredQty: Math.round(item.requiredQty * 10000) / 10000,
        plannedQty: Math.round(item.plannedQty * 10000) / 10000,
        consumedQty: Math.round(item.consumedQty * 10000) / 10000,
        shortageQty: Math.round(shortageQty * 10000) / 10000,
        coveragePercent,
        estimatedShortageCost,
        status: shortageQty > 0 ? 'Shortage' : 'Covered'
      };
    }).sort((a, b) => b.shortageQty - a.shortageQty || a.material.localeCompare(b.material));

    return {
      activeJobCount: active.length,
      requirementCount: jobRequirements.length,
      byMaterial,
      jobRequirements,
      shortages: byMaterial.filter((item) => item.shortageQty > 0),
      issues
    };
  }

  return { activeJobs, upsertRequirement, calculatePlan };
});
