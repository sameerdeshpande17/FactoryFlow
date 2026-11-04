const inventory = require('./inventory.js');

const OPEN_PURCHASE_STATUSES = new Set(['Confirmed', 'In transit', 'Part received']);

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boundedInteger(value, fallback, min, max, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    if (value === undefined || value === null || value === '') return fallback;
    throw new Error(label + ' must be a whole number between ' + min + ' and ' + max + '.');
  }
  return number;
}

function normalizeOptions(options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  if (!Number.isFinite(now.getTime())) throw new Error('Forecast date must be valid.');
  return {
    now,
    lookbackDays: boundedInteger(options.lookbackDays, 30, 7, 365, 'Lookback window'),
    recentDays: Math.min(7, boundedInteger(options.recentDays, 7, 1, 30, 'Recent window'))
  };
}

function validateSettings(input, material = {}) {
  const values = {
    leadTimeDays: boundedInteger(input.leadTimeDays, finiteNumber(material.leadTimeDays, 7), 0, 365, 'Supplier lead time'),
    safetyStockDays: boundedInteger(input.safetyStockDays, finiteNumber(material.safetyStockDays, 7), 0, 365, 'Safety stock days'),
    reviewPeriodDays: boundedInteger(input.reviewPeriodDays, finiteNumber(material.reviewPeriodDays, 7), 1, 90, 'Review period'),
    minimumOrderQty: finiteNumber(input.minimumOrderQty === undefined ? material.minimumOrderQty : input.minimumOrderQty, 0),
    orderMultiple: finiteNumber(input.orderMultiple === undefined ? material.orderMultiple : input.orderMultiple, 1),
    preferredSupplier: String(input.preferredSupplier === undefined ? material.preferredSupplier || '' : input.preferredSupplier || '').trim()
  };
  if (values.minimumOrderQty < 0 || values.minimumOrderQty > 1e9) {
    throw new Error('Minimum order quantity must be between 0 and 1,000,000,000.');
  }
  if (values.orderMultiple <= 0 || values.orderMultiple > 1e9) {
    throw new Error('Order multiple must be greater than zero and no more than 1,000,000,000.');
  }
  if (values.preferredSupplier.length > 120) throw new Error('Preferred supplier name must be 120 characters or fewer.');
  return values;
}

function unitCost(material) {
  const value = material.unitCost;
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0
    ? Number(value)
    : null;
}

function buildMovementHistory(material, movements, settings) {
  const end = settings.now.getTime();
  const start = end - settings.lookbackDays * 24 * 60 * 60 * 1000;
  const recentStart = end - settings.recentDays * 24 * 60 * 60 * 1000;
  const stock = inventory.parseQuantity(material.onHand);
  const issues = [];
  const daily = new Map();
  let totalQty = 0;
  let recentQty = 0;
  let movementCount = 0;

  (Array.isArray(movements) ? movements : []).forEach((movement) => {
    if (!movement || movement.materialSku !== material.sku) return;
    // Maintenance spare issues reduce stock but are not production material demand.
    if (movement.workOrderId || movement.type === 'Maintenance issue') return;
    const isConsumption = movement.type === 'Consumption' || movement.direction === 'OUT';
    if (!isConsumption) return;
    const at = new Date(movement.createdAt || movement.timestamp || '').getTime();
    if (!Number.isFinite(at) || at < start || at > end) return;
    if (!stock || inventory.normalizeUnit(movement.unit) !== stock.unit) {
      issues.push({
        movementId: movement.id || '',
        message: 'Consumption unit does not match current stock unit for ' + material.item + '.'
      });
      return;
    }
    const quantity = Number(movement.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      issues.push({
        movementId: movement.id || '',
        message: 'Invalid consumption quantity recorded for ' + material.item + '.'
      });
      return;
    }
    const date = new Date(at);
    const dayKey = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    daily.set(dayKey, (daily.get(dayKey) || 0) + quantity);
    totalQty += quantity;
    if (at >= recentStart) recentQty += quantity;
    movementCount += 1;
  });

  const fullRate = totalQty / settings.lookbackDays;
  const recentRate = recentQty / settings.recentDays;
  const dailyRate = movementCount
    ? Math.max(0, fullRate * 0.6 + recentRate * 0.4)
    : 0;
  return {
    totalQty: round(totalQty),
    recentQty: round(recentQty),
    fullRate: round(fullRate),
    recentRate: round(recentRate),
    dailyRate: round(dailyRate),
    movementCount,
    activeConsumptionDays: daily.size,
    issues
  };
}

function openIncomingFor(material, purchases) {
  const stock = inventory.parseQuantity(material.onHand);
  let quantity = 0;
  const orders = [];
  (Array.isArray(purchases) ? purchases : []).forEach((purchase) => {
    if (!purchase || !OPEN_PURCHASE_STATUSES.has(purchase.status)) return;
    const matches = purchase.materialSku
      ? purchase.materialSku === material.sku
      : String(purchase.material || '').trim().toLocaleLowerCase() === String(material.item || '').trim().toLocaleLowerCase();
    if (!matches) return;
    const ordered = Number(purchase.quantity);
    const received = Number(purchase.receivedQty || 0);
    if (!Number.isFinite(ordered) || ordered <= 0 || !Number.isFinite(received)) return;
    if (!stock || inventory.normalizeUnit(purchase.unit) !== stock.unit) return;
    const open = Math.max(0, ordered - Math.max(0, received));
    if (!open) return;
    quantity += open;
    orders.push({ id: purchase.id, quantity: round(open), unit: stock.unitLabel, status: purchase.status, delivery: purchase.delivery || '' });
  });
  return { quantity: round(quantity), orders };
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}

function roundOrderQuantity(quantity, minimum, multiple) {
  if (quantity <= 0) return 0;
  const base = Math.max(quantity, minimum);
  return round(Math.ceil((base - 1e-9) / multiple) * multiple);
}

function forecastMaterial(material, movements, purchases, options) {
  const stock = inventory.parseQuantity(material.onHand);
  const settings = {
    leadTimeDays: finiteNumber(material.leadTimeDays, 7),
    safetyStockDays: finiteNumber(material.safetyStockDays, 7),
    reviewPeriodDays: finiteNumber(material.reviewPeriodDays, 7),
    minimumOrderQty: finiteNumber(material.minimumOrderQty, 0),
    orderMultiple: finiteNumber(material.orderMultiple, 1),
    preferredSupplier: String(material.preferredSupplier || '')
  };
  const history = buildMovementHistory(material, movements, options);
  const incoming = openIncomingFor(material, purchases);
  const issues = [...history.issues];

  if (!stock) {
    return {
      materialSku: material.sku,
      material: material.item,
      unit: '',
      onHandQty: null,
      incomingQty: incoming.quantity,
      inventoryPosition: null,
      averageDailyDemand: history.dailyRate,
      lookbackDays: options.lookbackDays,
      movementCount: history.movementCount,
      dataQuality: 'Invalid stock',
      status: 'Needs data',
      issues: [{ message: 'Current stock quantity is invalid. Correct the material record before forecasting.' }, ...issues],
      recommendedOrderQty: 0,
      recommendedOrderCost: null
    };
  }

  const inventoryPosition = stock.quantity + incoming.quantity;
  const hasHistory = history.movementCount > 0;
  const leadDemand = history.dailyRate * settings.leadTimeDays;
  const safetyStock = history.dailyRate * settings.safetyStockDays;
  const reviewDemand = history.dailyRate * settings.reviewPeriodDays;
  const capacityFallback = Math.max(0, finiteNumber(material.capacity, 0) * 0.30);
  const fallbackReorderPoint = Math.max(0, finiteNumber(material.reorderLevel, capacityFallback));
  const reorderPoint = hasHistory ? leadDemand + safetyStock : fallbackReorderPoint;
  const targetStock = hasHistory
    ? reorderPoint + reviewDemand
    : fallbackReorderPoint;
  const isBelowReorderPoint = inventoryPosition <= reorderPoint;
  const rawOrderQty = isBelowReorderPoint ? Math.max(0, targetStock - inventoryPosition) : 0;
  const recommendedOrderQty = roundOrderQuantity(rawOrderQty, settings.minimumOrderQty, settings.orderMultiple);
  const cost = unitCost(material);
  const coverageDays = history.dailyRate > 0 ? round(inventoryPosition / history.dailyRate) : null;
  const daysToStockout = history.dailyRate > 0 ? round(stock.quantity / history.dailyRate) : null;
  const isReorder = isBelowReorderPoint && recommendedOrderQty > 0;
  const status = !hasHistory
    ? (isReorder ? 'Reorder' : 'No history')
    : inventoryPosition <= leadDemand
      ? 'Critical'
      : isReorder
        ? 'Reorder'
        : coverageDays !== null && coverageDays <= settings.leadTimeDays + settings.safetyStockDays + settings.reviewPeriodDays
          ? 'Watch'
          : 'Healthy';

  return {
    materialSku: material.sku,
    material: material.item,
    category: material.category || 'Other',
    supplier: String(material.preferredSupplier || ''),
    unit: stock.unitLabel,
    onHandQty: round(stock.quantity),
    incomingQty: incoming.quantity,
    inventoryPosition: round(inventoryPosition),
    averageDailyDemand: history.dailyRate,
    recentDailyDemand: history.recentRate,
    lookbackDays: options.lookbackDays,
    consumptionQty: history.totalQty,
    movementCount: history.movementCount,
    activeConsumptionDays: history.activeConsumptionDays,
    dataQuality: !hasHistory ? 'No history' : history.movementCount >= 8 && history.activeConsumptionDays >= 5 ? 'Good' : 'Limited',
    leadTimeDays: settings.leadTimeDays,
    safetyStockDays: settings.safetyStockDays,
    reviewPeriodDays: settings.reviewPeriodDays,
    leadDemand: round(leadDemand),
    safetyStockQty: round(safetyStock),
    reorderPoint: round(reorderPoint),
    targetStock: round(targetStock),
    coverageDays,
    daysToStockout,
    incomingOrders: incoming.orders,
    minimumOrderQty: settings.minimumOrderQty,
    orderMultiple: settings.orderMultiple,
    preferredSupplier: settings.preferredSupplier || '',
    unitCost: cost,
    recommendedOrderQty,
    recommendedOrderCost: cost === null ? null : round(recommendedOrderQty * cost),
    estimatedStockoutDate: daysToStockout === null
      ? null
      : new Date(options.now.getTime() + daysToStockout * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status,
    reorderRecommended: isReorder,
    issues
  };
}

function forecastInventory(materials, movements, purchases, rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  const items = (Array.isArray(materials) ? materials : []).map((material) =>
    forecastMaterial(material, movements, purchases, options)
  );
  const reorderItems = items.filter((item) => item.reorderRecommended);
  const estimatedSpend = reorderItems.every((item) => item.recommendedOrderCost !== null)
    ? round(reorderItems.reduce((sum, item) => sum + item.recommendedOrderCost, 0))
    : null;
  return {
    generatedAt: options.now.toISOString(),
    lookbackDays: options.lookbackDays,
    recentDays: options.recentDays,
    materialCount: items.length,
    reorderCount: reorderItems.length,
    criticalCount: items.filter((item) => item.status === 'Critical').length,
    watchCount: items.filter((item) => item.status === 'Watch').length,
    noHistoryCount: items.filter((item) => item.dataQuality === 'No history').length,
    estimatedSpend,
    items: items.sort((a, b) => {
      const priority = { Critical: 0, Reorder: 1, Watch: 2, 'Needs data': 3, Healthy: 4, 'No history': 5 };
      return (priority[a.status] ?? 6) - (priority[b.status] ?? 6) || a.material.localeCompare(b.material);
    })
  };
}

module.exports = {
  OPEN_PURCHASE_STATUSES,
  normalizeOptions,
  validateSettings,
  buildMovementHistory,
  openIncomingFor,
  forecastMaterial,
  forecastInventory
};
