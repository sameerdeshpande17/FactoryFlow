(function attachFactoryFlowCosting(root, factory) {
  const costing = factory();
  if (typeof module === 'object' && module.exports) module.exports = costing;
  if (root) root.FactoryFlowCosting = costing;
})(typeof globalThis === 'undefined' ? this : globalThis, function createFactoryFlowCosting() {
  'use strict';

  function optionalMoney(value) {
    if (value === null || value === undefined || value === '') return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  }

  function calculateJobCost(job, movements) {
    const revenue = optionalMoney(job && job.sellingValue);
    const workerCost = optionalMoney(job && job.workerCost) ?? 0;
    const otherCost = optionalMoney(job && job.otherCost) ?? 0;
    const consumption = (Array.isArray(movements) ? movements : []).filter((movement) =>
      movement.jobId === job.id && (movement.type === 'Consumption' || movement.direction === 'OUT')
    );

    let materialCost = 0;
    let pricedMovements = 0;
    let unpricedMovements = 0;

    consumption.forEach((movement) => {
      let lineCost = optionalMoney(movement.costAmount);
      if (lineCost === null) {
        const unitCost = optionalMoney(movement.unitCost);
        const quantity = Number(movement.quantity);
        if (unitCost !== null && Number.isFinite(quantity) && quantity >= 0) {
          lineCost = Math.round(unitCost * quantity * 100) / 100;
        }
      }
      if (lineCost === null) {
        unpricedMovements += 1;
      } else {
        materialCost += lineCost;
        pricedMovements += 1;
      }
    });

    materialCost = Math.round(materialCost * 100) / 100;
    const knownCost = Math.round((materialCost + workerCost + otherCost) * 100) / 100;
    const profit = revenue !== null && unpricedMovements === 0
      ? Math.round((revenue - knownCost) * 100) / 100
      : null;
    const marginPercent = profit !== null && revenue > 0
      ? Math.round((profit / revenue) * 10000) / 100
      : null;

    return {
      jobId: job && job.id,
      revenue,
      revenueConfigured: revenue !== null,
      materialCost,
      workerCost,
      otherCost,
      knownCost,
      profit,
      marginPercent,
      pricedMovements,
      unpricedMovements,
      complete: revenue !== null && unpricedMovements === 0
    };
  }

  return { calculateJobCost, optionalMoney };
});
