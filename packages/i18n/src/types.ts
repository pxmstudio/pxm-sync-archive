export type Locale = "en" | "ro";

export const LOCALES: Locale[] = ["en", "ro"];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ro: "Română",
};

export const DEFAULT_LOCALE: Locale = "en";

export type TranslationParams = Record<string, string | number>;

export type TranslationFunction = (
  key: string,
  params?: TranslationParams
) => string;

export interface Translations {
  common: CommonTranslations;
  navigation: NavigationTranslations;
  forms: FormsTranslations;
  auth: AuthTranslations;
  settings: SettingsTranslations;
  dashboard: DashboardTranslations;
  shop: ShopTranslations;
  orders: OrdersTranslations;
  suppliers: SuppliersTranslations;
  feeds: Record<string, unknown>;
  sync: SyncTranslations;
  activity: Record<string, unknown>;
  // Supplier-specific namespaces
  supplierDashboard: SupplierDashboardTranslations;
  products: ProductsTranslations;
  collections: CollectionsTranslations;
  retailers: RetailersTranslations;
  pricingTiers: PricingTiersTranslations;
}

export interface DashboardTranslations {
  title: string;
  subtitle: string;

  // Stats
  connectedFeeds: string;
  productSources: string;
  totalProducts: string;
  availableToSync: string;
  integrations: string;
  connectedStores: string;

  // Feeds section
  yourFeeds: string;
  subscribedProductSources: string;
  noFeedsConnected: string;
  browseFeeds: string;

  // Integrations section
  yourIntegrations: string;
  connectedStoreAccounts: string;
  noIntegrationsConnected: string;
  connectStore: string;
  manage: string;

  // Quick actions
  getStarted: string;
  quickActionsDescription: string;
  browseProducts: string;
  viewAvailableProducts: string;
  findProductSources: string;
  syncSettings: string;
  configureStoreSync: string;

  // Common
  viewAll: string;
  tryAgain: string;
  failedToLoad: string;
}

export interface CommonTranslations {
  continue: string;
  back: string;
  save: string;
  saving: string;
  cancel: string;
  submit: string;
  delete: string;
  edit: string;
  close: string;
  loading: string;
  error: string;
  success: string;
  confirm: string;
  skipForNow: string;
  search: string;
  noResults: string;
  selectOption: string;
  required: string;
  optional: string;
  actions: string;
  view: string;
  download: string;
  upload: string;
  remove: string;
  add: string;
  create: string;
  update: string;
  yes: string;
  no: string;
  connected: string;
  // User menu
  userMenu: {
    account: string;
    light: string;
    dark: string;
    logOut: string;
    user: string;
  };
}

export interface NavigationTranslations {
  dashboard: string;
  shop: string;
  suppliers: string;
  feeds: string;
  orders: string;
  sync: string;
  activity: string;
  settings: string;
  products: string;
  collections: string;
  retailers: string;
  pricingTiers: string;
  general: string;
  organization: string;
  team: string;
  notifications: string;
  integrations: string;
  apiKeys: string;
  webhooks: string;
  visibility: string;
  shipping: string;
  applicationFields: string;
  // Secondary navigation
  support: string;
  docs: string;
  // Organization switcher
  organizations: string;
  createOrganization: string;
  selectOrganization: string;
  switchToSupplierPortal: string;
  switchToRetailerPortal: string;
}

export interface FormsTranslations {
  labels: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    website: string;
    taxCode: string;
    address: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    companyName: string;
    description: string;
    name: string;
    role: string;
    password: string;
    confirmPassword: string;
  };
  placeholders: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    website: string;
    taxCode: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    selectCountry: string;
    searchCountries: string;
    search: string;
    enterValue: string;
  };
  validation: {
    required: string;
    invalidEmail: string;
    invalidUrl: string;
    invalidPhone: string;
    minLength: string;
    maxLength: string;
    selectCountry: string;
    passwordMismatch: string;
  };
}

export interface AuthTranslations {
  signIn: {
    title: string;
    subtitle: string;
    subtitleSupplier: string;
    continueWithGoogle: string;
    or: string;
    orContinueWith: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    forgotPassword: string;
    signingIn: string;
    signIn: string;
    noAccount: string;
    signUp: string;
    areYouSupplier: string;
    areYouRetailer: string;
    goToSupplierPortal: string;
    goToRetailerPortal: string;
    showPassword: string;
    hidePassword: string;
    googleSignInFailed: string;
    signInFailed: string;
    signInIncomplete: string;
    additionalVerification: string;
  };
  signUp: {
    title: string;
    subtitle: string;
    subtitleSupplier: string;
    continueWithGoogle: string;
    or: string;
    firstName: string;
    firstNamePlaceholder: string;
    lastName: string;
    lastNamePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    passwordRequirements: string;
    termsAgreement: string;
    termsOfService: string;
    and: string;
    privacyPolicy: string;
    creatingAccount: string;
    continue: string;
    haveAccount: string;
    signIn: string;
    areYouSupplier: string;
    areYouRetailer: string;
    goToSupplierPortal: string;
    goToRetailerPortal: string;
    showPassword: string;
    hidePassword: string;
    googleSignUpFailed: string;
    signUpFailed: string;
    additionalVerification: string;
    verificationIncomplete: string;
  };
  verify: {
    title: string;
    subtitle: string;
    verificationCode: string;
    verifying: string;
    verifyEmail: string;
    back: string;
    resendCode: string;
    sending: string;
    codeSent: string;
    failedToResend: string;
    incorrectCode: string;
    verificationFailed: string;
  };
  twoFactor: {
    title: string;
    subtitle: string;
    verificationCode: string;
    verifying: string;
    verify: string;
    backToSignIn: string;
    incorrectCode: string;
    verificationFailed: string;
    verificationIncomplete: string;
  };
  forgotPassword: {
    title: string;
    subtitle: string;
    email: string;
    emailPlaceholder: string;
    sendingCode: string;
    sendResetCode: string;
    backToSignIn: string;
    failedToSend: string;
    checkEmail: string;
    enterCodeSentTo: string;
    verificationCode: string;
    verifying: string;
    verifyCode: string;
    useDifferentEmail: string;
    incorrectCode: string;
    verificationFailed: string;
    verificationIncomplete: string;
    setNewPassword: string;
    enterNewPassword: string;
    newPassword: string;
    confirmPassword: string;
    passwordRequirements: string;
    resettingPassword: string;
    resetPassword: string;
    passwordsDoNotMatch: string;
    passwordTooShort: string;
    passwordResetFailed: string;
    passwordResetIncomplete: string;
    passwordReset: string;
    passwordResetSuccess: string;
    continueToDashboard: string;
  };
  organization: {
    title: string;
    subtitle: string;
    logo: string;
    logoOptional: string;
    uploadLogo: string;
    logoFormats: string;
    logoPreview: string;
    removeLogo: string;
    selectImageFile: string;
    imageTooLarge: string;
    organizationName: string;
    organizationNamePlaceholder: string;
    organizationSlug: string;
    organizationSlugPlaceholder: string;
    slugDescription: string;
    slugInvalidFormat: string;
    slugAlreadyTaken: string;
    organizationNameRequired: string;
    organizationSlugRequired: string;
    creatingOrganization: string;
    continue: string;
    failedToCreate: string;
    unableToCreate: string;
  };
  supplierInvite: {
    joinWholesaleProgram: string;
    supplierUsingPxm: string;
    signUpToConnect: string;
    youAreInvited: string;
    joinWholesaleDescription: string;
    benefitWholesalePricing: string;
    benefitDirectOrdering: string;
    benefitSecurePayments: string;
  };
}

export interface SettingsTranslations {
  general: {
    title: string;
    subtitle: string;
    organizationDetails: string;
    basicInfo: string;
    organizationName: string;
    organizationLogo: string;
    uploadLogo: string;
    logoRecommendation: string;
    slug: string;
    slugCannotChange: string;
    organizationId: string;
    useIdForApi: string;
    saveChanges: string;
    saving: string;
    settingsSaved: string;
    failedToUpdate: string;
    timezone: string;
    currency: string;
    // Supplier general settings
    website: string;
    defaultCurrency: string;
    defaultCurrencyDescription: string;
    supplierProfile: string;
    supplierProfileDescription: string;
    publicDescription: string;
    publicDescriptionPlaceholder: string;
    publicDescriptionHint: string;
    charactersCount: string;
    contactInfo: string;
    contactInfoDescription: string;
  };
  team: {
    title: string;
    subtitle: string;
    members: string;
    membersCount: string;
    inviteMember: string;
    inviteTeamMembers: string;
    sendEmailInvitations: string;
    pendingInvitations: string;
    pending: string;
    noMembersYet: string;
    failedToSend: string;
    failedToRemove: string;
    failedToUpdateRole: string;
    removeFromTeam: string;
    removingMember: string;
    confirmRemove: string;
    willLoseAccess: string;
    removing: string;
    remove: string;
    promoteToAdmin: string;
    demoteToMember: string;
    you: string;
    roles: {
      owner: string;
      admin: string;
      member: string;
    };
  };
  notifications: {
    title: string;
    subtitle: string;
    emailNotifications: string;
    pageTitle: string;
    pageSubtitle: string;
    chooseNotifications: string;
    // Feed sync notifications
    syncCompleted: string;
    syncCompletedDesc: string;
    syncFailed: string;
    syncFailedDesc: string;
    newProducts: string;
    newProductsDesc: string;
    integrationIssues: string;
    integrationIssuesDesc: string;
    preferenceSaved: string;
    failedToSave: string;
    // Digest notifications
    digestReports: string;
    digestReportsDesc: string;
    weeklyDigest: string;
    weeklyDigestDesc: string;
    monthlyDigest: string;
    monthlyDigestDesc: string;
    requiresGrowthPlan: string;
  };
  integrations: {
    title: string;
    subtitle: string;
    connected: string;
    available: string;
    connect: string;
    disconnect: string;
    configure: string;
    // Single store UI
    yourStore: string;
    yourStoreDescription: string;
    connectYourStore: string;
    connectYourStoreDescription: string;
    needDifferentStore: string;
    since: string;
    // Legacy multi-store UI
    storeIntegrations: string;
    storeIntegrationsDescription: string;
    connectStore: string;
    active: string;
    inactive: string;
    openShopifyAdmin: string;
    provider: string;
    purpose: string;
    productExport: string;
    productImport: string;
    connectedDate: string;
    status: string;
    ready: string;
    noStoresConnected: string;
    noStoresConnectedDescription: string;
    connectShopify: string;
    integrationDisconnected: string;
    failedToDisconnect: string;
    storeConnected: string;
    disconnectStore: string;
    disconnectStoreDescription: string;
    cancel: string;
    disconnecting: string;
    tryAgain: string;
    howItWorks: string;
    howItWorksStep1: string;
    howItWorksStep1Description: string;
    howItWorksStep2: string;
    howItWorksStep2Description: string;
    howItWorksStep3: string;
    howItWorksStep3Description: string;
    shopify: {
      connectTitle: string;
      connectDescription: string;
      shopDomain: string;
      shopDomainPlaceholder: string;
      shopDomainHelp: string;
      accessToken: string;
      accessTokenPlaceholder: string;
      accessTokenTooltip: string;
      requiredScopes: string;
      invalidDomain: string;
      domainRequired: string;
      tokenRequired: string;
      failedToConnect: string;
    };
    // Supplier integrations
    ecommercePlatforms: string;
    paymentProviders: string;
    openAdmin: string;
    sync: string;
    updateCredentials: string;
    dashboard: string;
    pending: string;
    connectingAccount: string;
    // Shopify supplier integration
    connectShopifyStore: string;
    disconnectShopify: string;
    disconnectShopifyDescription: string;
    allFieldsRequired: string;
    setupInstructions: string;
    setupStep1: string;
    setupStep2: string;
    setupStep3: string;
    setupStep4: string;
    setupStep5: string;
    scopeWriteProducts: string;
    scopeWriteInventory: string;
    scopeReadLocations: string;
    scopeReadShipping: string;
    supplierShopDomainPlaceholder: string;
    supplierAccessTokenPlaceholder: string;
    // Stripe integration
    connectStripeDescription: string;
    connectStripe: string;
    paymentsPayoutsEnabled: string;
    completeVerification: string;
    completeSetup: string;
    disconnectStripe: string;
    disconnectStripeDescription: string;
    failedToStartStripe: string;
    failedToDisconnectStripe: string;
    failedToConnectStripe: string;
  };
  apiKeys: {
    title: string;
    subtitle: string;
    createKey: string;
    keyName: string;
    lastUsed: string;
    revoke: string;
    description: string;
    viewDocs: string;
    noKeys: string;
    noKeysDescription: string;
    keyColumn: string;
    scopesColumn: string;
    createdColumn: string;
    revokeKey: string;
    tryAgain: string;
    upgrade: {
      title: string;
      description: string;
      learnMore: string;
    };
    time: {
      never: string;
      today: string;
      yesterday: string;
      daysAgo: string;
      weeksAgo: string;
    };
    create: {
      title: string;
      description: string;
      name: string;
      namePlaceholder: string;
      scopes: string;
      scopesDescription: string;
      freeScopes: string;
      proScopes: string;
      proScopesLocked: string;
      cancel: string;
      creating: string;
    };
    created: {
      title: string;
      description: string;
      copyWarning: string;
      copied: string;
      done: string;
      yourKey: string;
      usageExample: string;
    };
    scopes: {
      catalog: string;
      catalogDesc: string;
      products: string;
      productsDesc: string;
      inventory: string;
      inventoryDesc: string;
      ordersRead: string;
      ordersReadDesc: string;
      ordersWrite: string;
      ordersWriteDesc: string;
      connections: string;
      connectionsDesc: string;
      webhooksRead: string;
      webhooksReadDesc: string;
      webhooksWrite: string;
      webhooksWriteDesc: string;
    };
    revokeDialog: {
      title: string;
      description: string;
      cancel: string;
      revoking: string;
    };
  };
  webhooks: {
    title: string;
    subtitle: string;
    createWebhook: string;
    endpoint: string;
    events: string;
    status: string;
    addWebhook: string;
    noWebhooks: string;
    noWebhooksDescription: string;
    urlColumn: string;
    eventsColumn: string;
    statusColumn: string;
    createdColumn: string;
    active: string;
    inactive: string;
    failures: string;
    tryAgain: string;
    edit: string;
    sendTest: string;
    sending: string;
    viewDeliveries: string;
    delete: string;
    webhookEnabled: string;
    webhookDisabled: string;
    webhookUpdated: string;
    webhookDeleted: string;
    failedToUpdate: string;
    failedToSendTest: string;
    testDelivered: string;
    testFailed: string;
    upgrade: {
      title: string;
      subtitle: string;
      description: string;
      starterDescription: string;
      whatYouGet: string;
      features: {
        realTime: string;
        autoOrder: string;
        inventorySync: string;
        customEvents: string;
      };
      upgradeToPro: string;
      upgradeToGrowth: string;
      viewPricing: string;
      viewPlans: string;
    };
    create: {
      title: string;
      description: string;
      url: string;
      urlPlaceholder: string;
      events: string;
      eventsDescription: string;
      secret: string;
      secretDescription: string;
      cancel: string;
      creating: string;
    };
    created: {
      title: string;
      description: string;
      secretWarning: string;
      copied: string;
      done: string;
      verifyingTitle: string;
      verifyingDescription: string;
    };
    editDialog: {
      title: string;
      description: string;
      cancel: string;
      saving: string;
      save: string;
    };
    deleteDialog: {
      title: string;
      description: string;
      cancel: string;
      deleting: string;
    };
    deliveries: {
      title: string;
      description: string;
      noDeliveries: string;
      close: string;
      timestamp: string;
      event: string;
      statusColumn: string;
      responseTime: string;
      succeeded: string;
      failed: string;
      ms: string;
    };
  };
  // Supplier-specific settings
  shipping: {
    title: string;
    subtitle: string;
    zones: string;
    zonesDescription: string;
    addZone: string;
    noZones: string;
    noZonesDescription: string;
    zoneName: string;
    countries: string;
    rate: string;
    freeShippingThreshold: string;
    freeAbove: string;
    editZone: string;
    deleteZone: string;
    savedSuccess: string;
    savedError: string;
    deleteConfirm: string;
    deleteDescription: string;
    deleting: string;
    cancel: string;
    // Supplier shipping settings
    worldwide: string;
    zonesConfigured: string;
    zonesConfigured_plural: string;
    syncFromShopify: string;
    syncSuccess: string;
    failedToSync: string;
    noShippingZones: string;
    noShippingZonesDescription: string;
    addFirstZone: string;
    inactive: string;
    defaultBadge: string;
    methodsCount: string;
    methodsCount_plural: string;
    more: string;
    addMethod: string;
    noMethodsYet: string;
    noEstimate: string;
    daysEstimate: string;
    editMethod: string;
    addRate: string;
    deleteMethod: string;
    noRatesConfigured: string;
    addARate: string;
    editRate: string;
    deleteRate: string;
    addAnotherMethod: string;
    deleteShippingZone: string;
    deleteZoneDescription: string;
    deleteShippingMethod: string;
    deleteMethodDescription: string;
    deleteShippingRate: string;
    deleteRateDescription: string;
    delete: string;
    failedToDeleteZone: string;
    failedToDeleteMethod: string;
    failedToDeleteRate: string;
    rateTypes: {
      flatRate: string;
      weightBased: string;
      priceBased: string;
      itemCount: string;
      firstAdditional: string;
      custom: string;
    };
    tiers: string;
    zoneDialog: {
      editTitle: string;
      createTitle: string;
      description: string;
      zoneName: string;
      zoneNamePlaceholder: string;
      descriptionLabel: string;
      descriptionPlaceholder: string;
      countriesLabel: string;
      selectCountries: string;
      worldwideLabel: string;
      selectedCount: string;
      searchCountries: string;
      noCountryFound: string;
      worldwideAllCountries: string;
      priority: string;
      priorityHint: string;
      active: string;
      activeDescription: string;
      cancel: string;
      saving: string;
      saveChanges: string;
      createZone: string;
      zoneNameRequired: string;
      selectAtLeastOneCountry: string;
      failedToSaveZone: string;
    };
    methodDialog: {
      editTitle: string;
      addTitle: string;
      description: string;
      methodName: string;
      methodNamePlaceholder: string;
      descriptionLabel: string;
      descriptionPlaceholder: string;
      carrier: string;
      carrierPlaceholder: string;
      minDays: string;
      maxDays: string;
      customDeliveryLabel: string;
      customDeliveryLabelPlaceholder: string;
      customDeliveryLabelHint: string;
      defaultMethod: string;
      defaultMethodDescription: string;
      active: string;
      activeDescription: string;
      cancel: string;
      saving: string;
      saveChanges: string;
      addMethod: string;
      methodNameRequired: string;
      failedToSaveMethod: string;
    };
    rateDialog: {
      editTitle: string;
      addTitle: string;
      description: string;
      rateType: string;
      flatRate: string;
      flatRateDescription: string;
      weightBased: string;
      weightBasedDescription: string;
      priceBased: string;
      priceBasedDescription: string;
      itemCount: string;
      itemCountDescription: string;
      firstAdditional: string;
      firstAdditionalDescription: string;
      amount: string;
      baseAmount: string;
      perUnit: string;
      per: string;
      unit: string;
      weightExample: string;
      priceTiers: string;
      minValue: string;
      maxValue: string;
      noLimit: string;
      shipping: string;
      addTier: string;
      baseAmountLabel: string;
      perItem: string;
      itemCountExample: string;
      firstItem: string;
      eachAdditional: string;
      firstAdditionalExample: string;
      currency: string;
      selectCurrency: string;
      searchCurrencies: string;
      noCurrencyFound: string;
      active: string;
      activeDescription: string;
      cancel: string;
      saving: string;
      saveChanges: string;
      addRate: string;
      enterValidAmount: string;
      enterValidBaseAmount: string;
      enterValidPerUnitAmount: string;
      allTiersMustHaveAmounts: string;
      enterValidPerItemAmount: string;
      enterValidFirstItemAmount: string;
      enterValidAdditionalItemAmount: string;
      failedToSaveRate: string;
    };
  };
  visibility: {
    title: string;
    subtitle: string;
    profileVisibility: string;
    profileVisibilityDescription: string;
    public: string;
    publicDescription: string;
    private: string;
    privateDescription: string;
    inviteOnly: string;
    inviteOnlyDescription: string;
    savedSuccess: string;
    savedError: string;
    // Supplier visibility settings
    controlDiscovery: string;
    unlisted: string;
    publicProfile: string;
    retailersCanFind: string;
    onlyDirectLink: string;
    listedInDirectory: string;
    discoverableViaSearch: string;
    anyoneCanApply: string;
    notShownInDirectory: string;
    onlyViaDirectLink: string;
    moreControlOverApplies: string;
  };
  applicationFields: {
    title: string;
    subtitle: string;
    customFields: string;
    customFieldsDescription: string;
    addField: string;
    noFields: string;
    noFieldsDescription: string;
    fieldName: string;
    fieldType: string;
    required: string;
    optional: string;
    editField: string;
    deleteField: string;
    savedSuccess: string;
    savedError: string;
    fieldTypes: {
      text: string;
      textarea: string;
      select: string;
      checkbox: string;
      file: string;
    };
    // Supplier application fields
    fieldsConfigured: string;
    fieldsConfigured_plural: string;
    noCustomFields: string;
    noCustomFieldsDescription: string;
    addFirstField: string;
    edit: string;
    delete: string;
    deleteFieldTitle: string;
    deleteFieldDescription: string;
    cancel: string;
    deleting: string;
    failedToDelete: string;
    types: {
      text: string;
      longText: string;
      number: string;
      email: string;
      phone: string;
      url: string;
      file: string;
      dropdown: string;
      checkbox: string;
    };
    fieldDialog: {
      editTitle: string;
      addTitle: string;
      editDescription: string;
      addDescription: string;
      fieldName: string;
      fieldNamePlaceholder: string;
      fieldNameHint: string;
      label: string;
      labelPlaceholder: string;
      helpText: string;
      helpTextPlaceholder: string;
      fieldType: string;
      options: string;
      addOption: string;
      maxFileSize: string;
      allowedFileTypes: string;
      requiredField: string;
      cancel: string;
      saving: string;
      saveChanges: string;
      addField: string;
      failedToSave: string;
      typeDescriptions: {
        text: string;
        textarea: string;
        number: string;
        email: string;
        phone: string;
        url: string;
        file: string;
        select: string;
        checkbox: string;
      };
    };
  };
}

export interface SuppliersTranslations {
  title: string;
  subtitle: string;
  breadcrumb: string;
  searchPlaceholder: string;
  communityLibrary: {
    title: string;
    description: string;
    browseTitle: string;
    browseSubtitle: string;
    noSuppliers: string;
    noSuppliersDescription: string;
    upgrade: string;
  };
  tabs: {
    discover: string;
    connected: string;
    pending: string;
  };
  empty: {
    noResults: string;
    tryDifferentSearch: string;
    noConnected: string;
    noConnectedDescription: string;
    noPending: string;
    noPendingDescription: string;
    noSuppliers: string;
    noSuppliersDescription: string;
    browseAll: string;
  };
  pagination: {
    showing: string;
    to: string;
    of: string;
    suppliers: string;
    previous: string;
    next: string;
  };
  card: {
    connected: string;
    pending: string;
    viewProfile: string;
    connect: string;
    products: string;
  };
  error: {
    failedToLoad: string;
    supplierNotFound: string;
  };
  detail: {
    failedToLoad: string;
    noDescription: string;
    connectionStatus: string;
    applicationSubmitted: string;
    applicationPendingReview: string;
    connected: string;
    connectedDescription: string;
    viewConnection: string;
    copyFeedUrl: string;
    pending: string;
    pendingDescription: string;
    suspended: string;
    terminated: string;
    suspendedDescription: string;
    terminatedDescription: string;
    notConnected: string;
    applyToConnect: string;
    applicationRequirements: string;
    applicationRequirementsDescription: string;
    status: {
      applicationPending: string;
      connected: string;
      suspended: string;
      terminated: string;
    };
  };
  catalog: {
    tab: string;
    pricingTiers: string;
    productSync: string;
    searchPlaceholder: string;
    products: string;
    productsCount: string;
    productsCount_plural: string;
    noProductsFound: string;
    noProductsDescription: string;
    noProductsYet: string;
    clearFilters: string;
    showingResults: string;
  };
  filters: {
    title: string;
    clearAll: string;
    brands: string;
    productTypes: string;
    collections: string;
    searchBrands: string;
    searchTypes: string;
    searchCollections: string;
    showMore: string;
    showLess: string;
    noResults: string;
  };
}

export interface OrdersTranslations {
  title: string;
  subtitle: string;
  supplierSubtitle: string;
  breadcrumb: string;
  dashboard: string;
  noOrdersYet: string;
  noOrdersDescription: string;
  noOrdersSupplierDescription: string;
  failedToLoad: string;
  tryAgain: string;
  columns: {
    order: string;
    status: string;
    sync: string;
    supplier: string;
    retailer: string;
    items: string;
    total: string;
    date: string;
    ref: string;
  };
  syncStatuses: {
    synced: string;
    syncing: string;
    failed: string;
    pending: string;
  };
  statuses: {
    pending: string;
    paid: string;
    processing: string;
    shipped: string;
    delivered: string;
    cancelled: string;
    refunded: string;
  };
  actions: {
    openMenu: string;
    viewDetails: string;
    trackShipment: string;
    cancelOrder: string;
  };
  item: string;
  items: string;
  products: string;
  detail: {
    title: string;
    orderNumber: string;
    status: string;
    placedOn: string;
    placedAt: string;
    supplier: string;
    retailer: string;
    retailerRef: string;
    supplierRef: string;
    items: string;
    product: string;
    sku: string;
    qty: string;
    quantity: string;
    unitPrice: string;
    total: string;
    summary: string;
    subtotal: string;
    shipping: string;
    tax: string;
    discount: string;
    grandTotal: string;
    shippingInfo: string;
    shippingAddress: string;
    trackingNumber: string;
    trackShipment: string;
    backToOrders: string;
    cancelOrder: string;
    orderNotFound: string;
    goBack: string;
    tryAgain: string;
    viewInStripe: string;
    viewInShopify: string;
    payment: string;
    transaction: string;
    amount: string;
    fee: string;
    net: string;
    date: string;
    fulfillment: string;
    carrier: string;
    shippedAt: string;
    shopifySync: string;
    syncSynced: string;
    syncSyncing: string;
    syncFailed: string;
    syncPending: string;
    lastSynced: string;
    retrySync: string;
    syncToShopify: string;
    notes: string;
    fromRetailer: string;
    yourNote: string;
    timeline: string;
    delivered: string;
    shipped: string;
    processed: string;
    paid: string;
    placed: string;
    cancelled: string;
  };
}

export interface ShopTranslations {
  title: string;
  subtitle: string;
  breadcrumb: string;
  searchPlaceholder: string;
  product: string;
  products: string;
  gridView: string;
  listView: string;
  listViewQuickOrder: string;
  noActiveSuppliers: string;
  noActiveSuppliersDescription: string;
  findSuppliers: string;
  noProductsFound: string;
  tryAdjustingFilters: string;
  noProductsFromSuppliers: string;
  clearFilters: string;
  showingResults: string;
  of: string;
  filters: {
    title: string;
    clearAll: string;
    suppliers: string;
    feeds: string;
    brands: string;
    productTypes: string;
    collections: string;
    searchSuppliers: string;
    searchFeeds: string;
    searchBrands: string;
    searchTypes: string;
    searchCollections: string;
    showLess: string;
    showMore: string;
    noResults: string;
  };
  sort: {
    newest: string;
    oldest: string;
    nameAZ: string;
    nameZA: string;
  };
  empty: {
    noFeeds: string;
    noFeedsDescription: string;
    browseFeeds: string;
    noProducts: string;
    noProductsFiltered: string;
    noProductsYet: string;
  };
  quickOrder: {
    title: string;
    items: string;
    units: string;
    reviewSelections: string;
    clearAll: string;
    clearAllConfirm: string;
    clearAllDescription: string;
    addAllToCart: string;
    image: string;
    product: string;
    variant: string;
    price: string;
    qty: string;
    subtotal: string;
    total: string;
    inCart: string;
    cancel: string;
    default: string;
  };
  productCard: {
    addToCart: string;
    addedToCart: string;
    viewDetails: string;
    outOfStock: string;
    inStock: string;
    unitsAvailable: string;
    alreadyInCart: string;
    startingAt: string;
    variants: string;
    from: string;
  };
  upgrade: {
    title: string;
    description: string;
    whatYouGet: string;
    viewPlans: string;
    features: {
      browseProducts: string;
      searchFilter: string;
      viewDetails: string;
      syncToStore: string;
    };
  };
}

export interface SyncTranslations {
  title: string;
  subtitle: string;
  breadcrumb: string;
  upgrade: {
    title: string;
    subtitle: string;
    unlockTitle: string;
    unlockDescription: string;
    whatYouGet: string;
    features: {
      mapFields: string;
      controlBehavior: string;
      setExclusions: string;
      configureSettings: string;
      automaticSync: string;
    };
    upgradeToPro: string;
    viewPricing: string;
    viewPlans: string;
    supportedPlatforms: string;
    comingSoon: string;
  };
  integrations: {
    selectStore: string;
    configured: string;
    notConfigured: string;
    noIntegrations: string;
    noIntegrationsDescription: string;
    goToIntegrations: string;
    connectStoreFirst: string;
  };
  configuration: {
    title: string;
    subtitle: string;
    configure: string;
    configureDescription: string;
    createWithDefaults: string;
    resetToDefaults: string;
  };
  tabs: {
    mappings: string;
    rules: string;
    settings: string;
    pricing: string;
    locks: string;
  };
  fieldLocks: {
    savedSuccess: string;
    savedError: string;
  };
  fieldMappings: {
    productTitle: string;
    productDescription: string;
    variantTitle: string;
    variantDescription: string;
    tableHeaders: {
      active: string;
      yourField: string;
      shopifyField: string;
      syncMode: string;
    };
    badges: {
      product: string;
      variant: string;
    };
    syncModes: {
      always: string;
      alwaysDescription: string;
      createOnly: string;
      createOnlyDescription: string;
      ifEmpty: string;
      ifEmptyDescription: string;
    };
    syncModeExplained: string;
    syncModeAlwaysExplained: string;
    syncModeCreateOnlyExplained: string;
    syncModeIfEmptyExplained: string;
    saveFieldMappings: string;
    savedSuccess: string;
    savedError: string;
    createdSuccess: string;
    resetSuccess: string;
    resetError: string;
  };
  exclusionRules: {
    title: string;
    description: string;
    addRule: string;
    noRules: string;
    noRulesDescription: string;
    addFirstRule: string;
    activeRules: string;
    matchingAnyRule: string;
    ruleName: string;
    ruleNamePlaceholder: string;
    condition: string;
    excludeProductsWhere: string;
    active: string;
    disabled: string;
    removeRule: string;
    saveExclusionRules: string;
    savedSuccess: string;
    savedError: string;
    fields: {
      brand: string;
      productType: string;
      tag: string;
      sku: string;
      price: string;
      title: string;
      stock: string;
    };
    operators: {
      equals: string;
      notEquals: string;
      contains: string;
      notContains: string;
      startsWith: string;
      endsWith: string;
      greaterThan: string;
      lessThan: string;
      between: string;
    };
    examples: {
      title: string;
      category: string;
      categoryExample: string;
      lowPriced: string;
      lowPricedExample: string;
      brands: string;
      brandsExample: string;
      tags: string;
      tagsExample: string;
    };
    valuePlaceholder: string;
    pricePlaceholder: string;
    noValue: string;
    selectBrand: string;
    searchBrand: string;
    noBrandsFound: string;
    selectProductType: string;
    searchProductType: string;
    noProductTypesFound: string;
    selectTag: string;
    searchTag: string;
    noTagsFound: string;
  };
  syncSettings: {
    enableSync: string;
    enableSyncDescription: string;
    syncEnabled: string;
    syncDisabled: string;
    productBehavior: {
      title: string;
      description: string;
      createNew: string;
      createNewDescription: string;
      createNewTooltip: string;
      deleteRemoved: string;
      deleteRemovedDescription: string;
      deleteRemovedTooltip: string;
      defaultStatus: string;
      defaultStatusDescription: string;
      defaultStatusTooltip: string;
      publishToChannels: string;
      publishToChannelsDescription: string;
      publishToChannelsTooltip: string;
      statuses: {
        active: string;
        draft: string;
        archived: string;
      };
    };
    dataSync: {
      title: string;
      description: string;
      syncImages: string;
      syncImagesDescription: string;
      syncInventory: string;
      syncInventoryDescription: string;
    };
    defaults: {
      title: string;
      description: string;
      skuPrefix: string;
      skuPrefixDescription: string;
      skuPrefixTooltip: string;
      skuPrefixPlaceholder: string;
      defaultVendor: string;
      defaultVendorDescription: string;
      defaultVendorTooltip: string;
      defaultVendorPlaceholder: string;
    };
    saveSyncSettings: string;
    savedSuccess: string;
    savedError: string;
    salesChannels: {
      title: string;
      description: string;
      allChannels: string;
      allChannelsDescription: string;
      selectedChannels: string;
      selectedChannelsDescription: string;
      noChannels: string;
      noChannelsDescription: string;
      selectChannels: string;
      refresh: string;
      loading: string;
      noChannelsFound: string;
    };
  };
  pricing: {
    title: string;
    description: string;
    enableDefault: string;
    marginTypes: {
      percentage: string;
      fixed: string;
    };
    markup: string;
    perItem: string;
    conditionalRules: string;
    conditionalRulesDescription: string;
    addRule: string;
    noRules: string;
    noRulesDescription: string;
    ruleName: string;
    margin: string;
    condition: string;
    when: string;
    priority: string;
    removeRule: string;
    example: string;
    exampleCalculation: string;
    willBeSyncedAt: string;
    marginDependsOnRules: string;
    savePricingSettings: string;
    savedSuccess: string;
    savedError: string;
    rounding: {
      title: string;
      description: string;
      strategy: string;
      strategies: {
        up: string;
        down: string;
        nearest: string;
      };
      precision: string;
      precisions: {
        wholeNumber: string;
        tenCents: string;
        nearestTen: string;
      };
      endWith: string;
      endWithDescription: string;
      endWithOptions: {
        none: string;
      };
    };
  };
  howItWorks: {
    title: string;
    step1Title: string;
    step1Description: string;
    step2Title: string;
    step2Description: string;
    step3Title: string;
    step3Description: string;
  };
  error: {
    title: string;
    failedToLoad: string;
    tryAgain: string;
  };
  help: {
    title: string;
    description: string;
  };
}

// Supplier-specific translation interfaces
export interface SupplierDashboardTranslations {
  title: string;
  subtitle: string;
  totalRevenue: string;
  fromOrders: string;
  activeProducts: string;
  totalProducts: string;
  activeRetailers: string;
  pendingApplications: string;
  noPendingApplications: string;
  avgOrderValue: string;
  perOrderAverage: string;
  ordersOverview: string;
  ordersByStatus: string;
  noOrdersYet: string;
  recentOrders: string;
  latestOrders: string;
  viewAll: string;
  ordersWillAppear: string;
  pendingApplicationsTitle: string;
  retailersWaiting: string;
  applied: string;
  pending: string;
  moreApplications: string;
  allCaughtUp: string;
  productsOverview: string;
  productCatalogStatus: string;
  total: string;
  active: string;
  inactive: string;
  productsNeedAttention: string;
  noProductsYet: string;
  syncProductsToStart: string;
  addProducts: string;
  topRetailers: string;
  retailersByRevenue: string;
  noRetailerDataYet: string;
  revenueByRetailerWillAppear: string;
  tryAgain: string;
  failedToLoad: string;
  orders: string;
  revenue: string;
  chart: {
    orders: string;
    pending: string;
    paid: string;
    processing: string;
    shipped: string;
    delivered: string;
    revenue: string;
  };
}

export interface ProductsTranslations {
  title: string;
  subtitle: string;
  breadcrumb: string;
  dashboard: string;
  searchPlaceholder: string;
  loadingPrices: string;
  product: string;
  products: string;
  productCount: string;
  productCountPlural: string;
  gridView: string;
  listView: string;
  noProductsFound: string;
  tryAdjustingSearch: string;
  connectIntegration: string;
  showingProducts: string;
  tryAgain: string;
  syncProducts: string;
  syncingProducts: string;
  syncNewOnly: string;
  fullSync: string;
  allProducts: string;
  newProductsOnly: string;
  syncFilters: string;
  syncingFilters: string;
  syncBrands: string;
  syncTags: string;
  syncCategories: string;
  syncAll: string;
  brands: string;
  tags: string;
  categories: string;
  allMetadata: string;
  filters: {
    title: string;
    clearAll: string;
    viewAsTier: string;
    basePrices: string;
    default: string;
    status: string;
    all: string;
    active: string;
    inactive: string;
    brands: string;
    productTypes: string;
    showMore: string;
    showLess: string;
    noResults: string;
    searchBrands: string;
    searchTypes: string;
    searchTags: string;
  };
  columns: {
    product: string;
    brand: string;
    type: string;
    variants: string;
    status: string;
    updated: string;
  };
  table: {
    variant: string;
    sku: string;
    price: string;
    inventory: string;
    available: string;
    reserved: string;
    noResults: string;
  };
  detail: {
    title: string;
    description: string;
    variants: string;
    variantsCount: string;
    pricing: string;
    brand: string;
    type: string;
    totalInventory: string;
    available: string;
    reserved: string;
    tags: string;
    images: string;
    viewingAs: string;
    updated: string;
    lastSynced: string;
    created: string;
    active: string;
    inactive: string;
    inventory: string;
    barcode: string;
    shopify: string;
  };
}

export interface CollectionsTranslations {
  title: string;
  subtitle: string;
  breadcrumb: string;
  dashboard: string;
  noCollections: string;
  syncFromShopify: string;
  tryAgain: string;
  showingCollections: string;
  syncCollections: string;
  syncing: string;
  columns: {
    collection: string;
    products: string;
    updated: string;
  };
}

export interface RetailersTranslations {
  title: string;
  subtitle: string;
  breadcrumb: string;
  dashboard: string;
  searchPlaceholder: string;
  tabs: {
    pending: string;
    active: string;
    all: string;
  };
  empty: {
    noPending: string;
    noPendingDescription: string;
    noActive: string;
    noActiveDescription: string;
    noConnections: string;
    noConnectionsDescription: string;
  };
  status: {
    pending: string;
    active: string;
    suspended: string;
    terminated: string;
  };
  actions: {
    reject: string;
    approve: string;
    view: string;
    suspend: string;
    terminate: string;
  };
  appliedAgo: string;
  connectedAgo: string;
  showingRetailers: string;
  failedToLoad: string;
  tryAgain: string;
  application: {
    title: string;
    businessInfo: string;
    businessDetails: string;
    contactPerson: string;
    submittedAt: string;
    customFields: string;
    message: string;
    noContact: string;
    taxCode: string;
    billingAddress: string;
    documents: string;
    registrationDocument: string;
    additionalInfo: string;
    yes: string;
    no: string;
    notProvided: string;
    failedToLoad: string;
    approving: string;
    rejecting: string;
    rejectTitle: string;
    rejectDescription: string;
    rejectReasonLabel: string;
    rejectReasonPlaceholder: string;
    cancel: string;
    rejectButton: string;
  };
}

export interface PricingTiersTranslations {
  title: string;
  subtitle: string;
  breadcrumb: string;
  dashboard: string;
  pricingBreadcrumb: string;
  newTier: string;
  noTiers: string;
  noTiersDescription: string;
  createTier: string;
  tryAgain: string;
  columns: {
    tier: string;
    default: string;
    inactive: string;
    qualification: string;
    manualOnly: string;
    minOrders: string;
    minDays: string;
    discounts: string;
    rules: string;
    rule: string;
    priority: string;
  };
  actions: {
    openMenu: string;
    edit: string;
    delete: string;
    cancel: string;
  };
  form: {
    name: string;
    namePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    isDefault: string;
    isDefaultDescription: string;
    isActive: string;
    isActiveDescription: string;
    priority: string;
    priorityDescription: string;
    qualification: string;
    qualificationDescription: string;
    minOrders: string;
    minDays: string;
    discountRules: string;
    discountRulesDescription: string;
    addRule: string;
    ruleType: string;
    percentage: string;
    fixedAmount: string;
    value: string;
    condition: string;
    allProducts: string;
    byBrand: string;
    byType: string;
    save: string;
    saving: string;
    cancel: string;
  };
  create: {
    title: string;
    description: string;
    tierName: string;
    creating: string;
  };
  edit: {
    title: string;
    description: string;
    editBreadcrumb: string;
  };
  delete: {
    title: string;
    description: string;
    deleting: string;
  };
  dialogs: {
    pricingRule: {
      addTitle: string;
      addDescription: string;
      editTitle: string;
      editDescription: string;
      ruleName: string;
      ruleNamePlaceholder: string;
      discountType: string;
      percentageOff: string;
      fixedAmountOff: string;
      fixedPrice: string;
      percentage: string;
      amount: string;
      price: string;
      invalidDiscount: string;
      failedToCreate: string;
      failedToUpdate: string;
      adding: string;
      addRule: string;
    };
    tierRule: {
      addTitle: string;
      addDescription: string;
      editTitle: string;
      editDescription: string;
      ruleType: string;
      entryToQualify: string;
      retentionToStay: string;
      entryDescription: string;
      retentionDescription: string;
      evaluationPeriod: string;
      lifetime: string;
      rolling12Months: string;
      rolling3Months: string;
      rolling1Month: string;
      criteria: string;
      criteriaRequired: string;
      minTotalSpent: string;
      minOrderCount: string;
      minDaysConnected: string;
      atLeastOneCriterion: string;
      failedToCreate: string;
      failedToUpdate: string;
      adding: string;
      addRule: string;
      active: string;
    };
  };
  detail: {
    tierNotFound: string;
    backToTiers: string;
    failedToLoad: string;
    tierDetails: string;
    tierDetailsDescription: string;
    active: string;
    inactiveTiersWontApply: string;
    defaultTier: string;
    applyToNewRetailers: string;
    tierName: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    priorityLabel: string;
    priorityDescription: string;
    deleteTier: string;
    deleteConfirmTitle: string;
    deleteConfirmDescription: string;
    saveChanges: string;
    tierSaved: string;
    failedToSave: string;
    failedToDelete: string;
  };
  pricingRules: {
    title: string;
    description: string;
    addRule: string;
    noRules: string;
    condition: string;
    conditions: string;
    allProducts: string;
    percentOff: string;
    amountOff: string;
    fixedPrice: string;
    deleteTitle: string;
    deleteDescription: string;
    fields: {
      brand: string;
      collection: string;
      product: string;
      variant: string;
      tag: string;
      productType: string;
      title: string;
      price: string;
      compareAtPrice: string;
      costPrice: string;
      weight: string;
      volume: string;
    };
    operators: {
      eq: string;
      neq: string;
      in: string;
      notIn: string;
      contains: string;
      gt: string;
      gte: string;
      lt: string;
      lte: string;
      between: string;
    };
  };
  qualificationRules: {
    title: string;
    description: string;
    addRule: string;
    noRules: string;
    entry: string;
    retention: string;
    lifetime: string;
    perYear: string;
    perQuarter: string;
    perMonth: string;
    inactive: string;
    spent: string;
    orders: string;
    daysConnected: string;
    noCriteria: string;
    deleteTitle: string;
    deleteDescription: string;
  };
  retailers: {
    title: string;
    description: string;
    noRetailers: string;
    noRetailersHint: string;
    retailer: string;
    ordersColumn: string;
    totalSpent: string;
    assigned: string;
  };
}

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationFunction;
  translations: Translations;
}
