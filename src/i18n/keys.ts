/**
 * Type-safe i18n key definitions
 *
 * This file provides compile-time validation for translation keys.
 * Import I18N_KEYS and use dot notation to get type-safe keys.
 *
 * Usage:
 * ```typescript
 * import { I18N_KEYS } from '../i18n/keys'
 *
 * // Type-safe key access
 * t(I18N_KEYS.common.loading)  // ✓ Validated at compile time
 * t(I18N_KEYS.common.typo)     // ✗ TypeScript error
 * ```
 *
 * Alternative: Use the useTypedTranslation hook for automatic type inference.
 */

// Translation key structure matching es.json
export const I18N_KEYS = {
  common: {
    loading: 'common.loading',
    close: 'common.close',
    cancel: 'common.cancel',
    confirm: 'common.confirm',
    continue: 'common.continue',
    save: 'common.save',
    delete: 'common.delete',
    edit: 'common.edit',
    back: 'common.back',
    retry: 'common.retry',
    optional: 'common.optional',
    or: 'common.or',
    yes: 'common.yes',
    no: 'common.no',
    error: 'common.error',
    success: 'common.success',
  },
  app: {
    title: 'app.title',
    subtitle: 'app.subtitle',
  },
  joinTable: {
    tableNumber: 'joinTable.tableNumber',
    tableNumberPlaceholder: 'joinTable.tableNumberPlaceholder',
    whatsYourName: 'joinTable.whatsYourName',
    namePlaceholder: 'joinTable.namePlaceholder',
    nameHelpAuth: 'joinTable.nameHelpAuth',
    nameHelpGuest: 'joinTable.nameHelpGuest',
    table: 'joinTable.table',
    joining: 'joinTable.joining',
    joinTable: 'joinTable.joinTable',
    changeTable: 'joinTable.changeTable',
    signInToSaveHistory: 'joinTable.signInToSaveHistory',
    continueAsGuest: 'joinTable.continueAsGuest',
    signOut: 'joinTable.signOut',
    sharedCart: 'joinTable.sharedCart',
    sharedCartDescription: 'joinTable.sharedCartDescription',
  },
  cart: {
    title: 'cart.title',
    table: 'cart.table',
    diner_one: 'cart.diner_one',
    diner_other: 'cart.diner_other',
    updating: 'cart.updating',
    closeCart: 'cart.closeCart',
    myOrders: 'cart.myOrders',
    myTotal: 'cart.myTotal',
    tableTotal: 'cart.tableTotal',
    submitOrder: 'cart.submitOrder',
    submitting: 'cart.submitting',
    retrySubmit: 'cart.retrySubmit',
    submitError: 'cart.submitError',
    emptyCart: 'cart.emptyCart',
    emptyCartDescription: 'cart.emptyCartDescription',
    viewMenu: 'cart.viewMenu',
    noActiveSession: 'cart.noActiveSession',
    you: 'cart.you',
    close: 'cart.close',
    diner: 'cart.diner',
  },
  product: {
    close: 'product.close',
    allergens: 'product.allergens',
    specialNotes: 'product.specialNotes',
    notesPlaceholder: 'product.notesPlaceholder',
    quantity: 'product.quantity',
    decreaseQuantity: 'product.decreaseQuantity',
    increaseQuantity: 'product.increaseQuantity',
    add: 'product.add',
    adding: 'product.adding',
    added: 'product.added',
  },
  bottomNav: {
    mainNav: 'bottomNav.mainNav',
    orderHistory: 'bottomNav.orderHistory',
    round: 'bottomNav.round',
    round_plural: 'bottomNav.round_plural',
    noOrders: 'bottomNav.noOrders',
    askForBill: 'bottomNav.askForBill',
    aiAssistant: 'bottomNav.aiAssistant',
  },
  orderSuccess: {
    orderSent: 'orderSuccess.orderSent',
    orderNumber: 'orderSuccess.orderNumber',
    preparing: 'orderSuccess.preparing',
  },
  orderHistory: {
    title: 'orderHistory.title',
    round: 'orderHistory.round',
    subtotal: 'orderHistory.subtotal',
    confirmedAt: 'orderHistory.confirmedAt',
    readyAt: 'orderHistory.readyAt',
    deliveredAt: 'orderHistory.deliveredAt',
    noOrders: 'orderHistory.noOrders',
    ordersWillAppear: 'orderHistory.ordersWillAppear',
    totalConsumed: 'orderHistory.totalConsumed',
    itemsInRounds: 'orderHistory.itemsInRounds',
    close: 'orderHistory.close',
    status: {
      submitted: 'orderHistory.status.submitted',
      confirmed: 'orderHistory.status.confirmed',
      preparing: 'orderHistory.status.preparing',
      ready: 'orderHistory.status.ready',
      delivered: 'orderHistory.status.delivered',
      paid: 'orderHistory.status.paid',
      cancelled: 'orderHistory.status.cancelled',
    },
  },
  header: {
    table: 'header.table',
    callWaiter: 'header.callWaiter',
    cart: 'header.cart',
    cartItems: 'header.cartItems',
    dinersAtTable: 'header.dinersAtTable',
    yourProfile: 'header.yourProfile',
  },
  closeTable: {
    title: 'closeTable.title',
    summary: 'closeTable.summary',
    orders: 'closeTable.orders',
    ordersCount: 'closeTable.ordersCount',
    splitBill: 'closeTable.splitBill',
    equalSplit: 'closeTable.equalSplit',
    byConsumption: 'closeTable.byConsumption',
    totalConsumed: 'closeTable.totalConsumed',
    ordersSummary: 'closeTable.ordersSummary',
    order_one: 'closeTable.order_one',
    order_other: 'closeTable.order_other',
    diners: 'closeTable.diners',
    requestBill: 'closeTable.requestBill',
    requesting: 'closeTable.requesting',
    waitingForWaiter: 'closeTable.waitingForWaiter',
    waiterOnTheWay: 'closeTable.waiterOnTheWay',
    estimatedTime: 'closeTable.estimatedTime',
    billReady: 'closeTable.billReady',
    subtotal: 'closeTable.subtotal',
    tip: 'closeTable.tip',
    total: 'closeTable.total',
    paymentMethods: 'closeTable.paymentMethods',
    cash: 'closeTable.cash',
    card: 'closeTable.card',
    transfer: 'closeTable.transfer',
    paid: 'closeTable.paid',
    thankYou: 'closeTable.thankYou',
    shareReceipt: 'closeTable.shareReceipt',
    leaveTable: 'closeTable.leaveTable',
    noSession: 'closeTable.noSession',
    cartWarningTitle: 'closeTable.cartWarningTitle',
    cartWarning: 'closeTable.cartWarning',
    cartErrorPending: 'closeTable.cartErrorPending',
    noOrdersToClose: 'closeTable.noOrdersToClose',
  },
  callWaiter: {
    title: 'callWaiter.title',
    confirm: 'callWaiter.confirm',
    calling: 'callWaiter.calling',
    called: 'callWaiter.called',
    calledDescription: 'callWaiter.calledDescription',
  },
  search: {
    placeholder: 'search.placeholder',
    noResults: 'search.noResults',
    tryDifferent: 'search.tryDifferent',
  },
  categories: {
    menuCategories: 'categories.menuCategories',
    home: 'categories.home',
    food: 'categories.food',
    drinks: 'categories.drinks',
    desserts: 'categories.desserts',
    all: 'categories.all',
    featured: 'categories.featured',
    starters: 'categories.starters',
    mains: 'categories.mains',
  },
  ai: {
    title: 'ai.title',
    subtitle: 'ai.subtitle',
    placeholder: 'ai.placeholder',
    welcome: 'ai.welcome',
    closeChat: 'ai.closeChat',
    messageHistory: 'ai.messageHistory',
    sendMessage: 'ai.sendMessage',
    suggestions: {
      recommend: 'ai.suggestions.recommend',
      vegetarian: 'ai.suggestions.vegetarian',
      desserts: 'ai.suggestions.desserts',
      drinks: 'ai.suggestions.drinks',
    },
  },
  errors: {
    generic: 'errors.generic',
    unexpected: 'errors.unexpected',
    details: 'errors.details',
    network: 'errors.network',
    tryAgain: 'errors.tryAgain',
  },
  language: {
    select: 'language.select',
    es: 'language.es',
    en: 'language.en',
    pt: 'language.pt',
  },
  home: {
    loading: 'home.loading',
    pageTitle: 'home.pageTitle',
    pageTitleDefault: 'home.pageTitleDefault',
    pageDescription: 'home.pageDescription',
    pageDescriptionDefault: 'home.pageDescriptionDefault',
    searchResults: 'home.searchResults',
    noProducts: 'home.noProducts',
    noProductsInCategory: 'home.noProductsInCategory',
    products: 'home.products',
    viewPromos: 'home.viewPromos',
    recommended: 'home.recommended',
    previous: 'home.previous',
    next: 'home.next',
  },
  qrSimulator: {
    title: 'qrSimulator.title',
    simulationMode: 'qrSimulator.simulationMode',
    simulationDescription: 'qrSimulator.simulationDescription',
    total: 'qrSimulator.total',
    free: 'qrSimulator.free',
    occupied: 'qrSimulator.occupied',
    allTables: 'qrSimulator.allTables',
    onlyFree: 'qrSimulator.onlyFree',
    back: 'qrSimulator.back',
    table: 'qrSimulator.table',
    statusFree: 'qrSimulator.statusFree',
    statusActive: 'qrSimulator.statusActive',
    statusReady: 'qrSimulator.statusReady',
    scanInstruction: 'qrSimulator.scanInstruction',
    simulateScan: 'qrSimulator.simulateScan',
    diners: 'qrSimulator.diners',
    dinersAtTable: 'qrSimulator.dinersAtTable',
  },
} as const

// Type for all valid translation keys (flattened)
export type TranslationKey =
  | `common.${keyof typeof I18N_KEYS.common}`
  | `app.${keyof typeof I18N_KEYS.app}`
  | `joinTable.${keyof typeof I18N_KEYS.joinTable}`
  | `cart.${keyof typeof I18N_KEYS.cart}`
  | `product.${keyof typeof I18N_KEYS.product}`
  | `bottomNav.${keyof typeof I18N_KEYS.bottomNav}`
  | `orderSuccess.${keyof typeof I18N_KEYS.orderSuccess}`
  | `orderHistory.${keyof typeof I18N_KEYS.orderHistory}`
  | `orderHistory.status.${keyof typeof I18N_KEYS.orderHistory.status}`
  | `header.${keyof typeof I18N_KEYS.header}`
  | `closeTable.${keyof typeof I18N_KEYS.closeTable}`
  | `callWaiter.${keyof typeof I18N_KEYS.callWaiter}`
  | `search.${keyof typeof I18N_KEYS.search}`
  | `categories.${keyof typeof I18N_KEYS.categories}`
  | `ai.${keyof typeof I18N_KEYS.ai}`
  | `ai.suggestions.${keyof typeof I18N_KEYS.ai.suggestions}`
  | `errors.${keyof typeof I18N_KEYS.errors}`
  | `language.${keyof typeof I18N_KEYS.language}`
  | `home.${keyof typeof I18N_KEYS.home}`
  | `qrSimulator.${keyof typeof I18N_KEYS.qrSimulator}`
