/**
 * Utility functions for formatting text in solution documents
 */

/**
 * Format program type names
 * Examples:
 * - ap_automation -> AP Automation
 * - consumer_credit -> Consumer Credit
 * - commercial_prepaid -> Commercial Prepaid
 */
export function formatProgramName(programType: string): string {
  return programType
    .split('_')
    .map(word => {
      // Handle special acronyms
      if (word.toLowerCase() === 'ap') return 'AP';
      if (word.toLowerCase() === 'api') return 'API';
      if (word.toLowerCase() === 'id') return 'ID';
      
      // Capitalize first letter of each word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Format capability names
 * Examples:
 * - virtual_card_issuance -> Virtual Card Issuance
 * - on_demand_funding -> On-Demand Funding
 * - real_time_webhooks -> Real-Time Webhooks
 * - multi_currency -> Multi-Currency
 */
export function formatCapability(capability: string): string {
  // Special cases for compound terms
  const specialCases: Record<string, string> = {
    'on_demand_funding': 'On-Demand Funding',
    'real_time_webhooks': 'Real-Time Webhooks',
    'multi_currency': 'Multi-Currency',
    'collaborative_authorization': 'Collaborative Authorization',
    'spend_controls': 'Spend Controls',
    'velocity_rules': 'Velocity Rules',
    'transaction_monitoring': 'Transaction Monitoring',
    'virtual_card_issuance': 'Virtual Card Issuance',
    'api_keys': 'API Keys',
    'two_factor_auth': 'Two-Factor Authentication',
    'kyc_kyb': 'KYC/KYB',
    'pci_dss': 'PCI DSS',
    'soc2_type2': 'SOC 2 Type II'
  };

  // Check for special cases first
  const lowerCapability = capability.toLowerCase();
  if (specialCases[lowerCapability]) {
    return specialCases[lowerCapability];
  }

  // Default formatting
  return capability
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format vendor names
 * Examples:
 * - highnote_inc -> Highnote Inc.
 * - stripe -> Stripe
 */
export function formatVendorName(vendor: string): string {
  const vendorMap: Record<string, string> = {
    'highnote_inc': 'Highnote Inc.',
    'highnote': 'Highnote',
    'stripe': 'Stripe',
    'marqeta': 'Marqeta',
    'lithic': 'Lithic',
    'galileo': 'Galileo'
  };

  const lowerVendor = vendor.toLowerCase();
  if (vendorMap[lowerVendor]) {
    return vendorMap[lowerVendor];
  }

  // Default: capitalize each word
  return vendor
    .split(/[_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format API type
 * Examples:
 * - graphql -> GraphQL
 * - rest -> REST
 * - soap -> SOAP
 */
export function formatApiType(apiType: string): string {
  const apiTypeMap: Record<string, string> = {
    'graphql': 'GraphQL',
    'rest': 'REST',
    'restful': 'RESTful',
    'soap': 'SOAP',
    'grpc': 'gRPC',
    'websocket': 'WebSocket'
  };

  const lowerType = apiType.toLowerCase();
  return apiTypeMap[lowerType] || apiType.toUpperCase();
}

/**
 * Format operation category names
 * Examples:
 * - api_keys -> API Keys
 * - card_product -> Card Product
 */
export function formatOperationCategory(category: string): string {
  const specialTerms: Record<string, string> = {
    'api': 'API',
    'kyc': 'KYC',
    'kyb': 'KYB',
    'mfa': 'MFA',
    'pci': 'PCI',
    'id': 'ID',
    'ip': 'IP',
    'url': 'URL',
    'uri': 'URI',
    'sdk': 'SDK'
  };

  return category
    .split('_')
    .map(word => {
      const lower = word.toLowerCase();
      return specialTerms[lower] || (word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    })
    .join(' ');
}

/**
 * Format customer name for display
 * Examples:
 * - trip_com -> TripLink.com
 * - expedia_group -> Expedia Group
 */
export function formatCustomerName(customer: string): string {
  const customerMap: Record<string, string> = {
    'trip_com': 'TripLink.com',
    'triplink': 'TripLink.com',
    'expedia': 'Expedia',
    'expedia_group': 'Expedia Group',
    'booking': 'Booking.com',
    'airbnb': 'Airbnb',
    'uber': 'Uber',
    'lyft': 'Lyft'
  };

  const lowerCustomer = customer.toLowerCase();
  if (customerMap[lowerCustomer]) {
    return customerMap[lowerCustomer];
  }

  // Default: replace underscores with spaces and capitalize
  return customer
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format rate limit values
 * Examples:
 * - "200 / 10 seconds" -> "200 requests per 10 seconds"
 */
export function formatRateLimit(value: string | number): string {
  if (typeof value === 'number') {
    return `${value} requests per second`;
  }
  
  // Parse string format "X / Y seconds"
  const match = value.match(/(\d+)\s*\/\s*(\d+)\s*(second|minute|hour)s?/i);
  if (match) {
    const [, count, time, unit] = match;
    return `${count} requests per ${time} ${unit}${parseInt(time) > 1 ? 's' : ''}`;
  }
  
  return value;
}

/**
 * Format performance metric values
 */
export function formatPerformanceMetric(key: string, value: any): string {
  const keyLower = key.toLowerCase();
  
  if (keyLower.includes('time') || keyLower.includes('latency')) {
    if (typeof value === 'number') {
      return `${value}ms`;
    }
  }
  
  if (keyLower.includes('availability') || keyLower.includes('uptime')) {
    if (typeof value === 'number') {
      return `${value}%`;
    }
  }
  
  if (keyLower.includes('rate') || keyLower.includes('limit')) {
    return formatRateLimit(value);
  }
  
  return String(value);
}