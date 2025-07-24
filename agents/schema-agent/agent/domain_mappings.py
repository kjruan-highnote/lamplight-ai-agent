"""
Domain-based operation mappings for GraphQL schema chunking.
Groups related operations by business domain for better retrieval and context.
"""

from typing import Dict, List, Set
import re

# Domain-based operation groupings
DOMAIN_OPERATIONS = {
    'financial_account_management': {
        'description': 'Operations for creating, issuing, and managing financial accounts',
        'keywords': ['financial account', 'account management', 'funding'],
        'mutations': [
            'issueFinancialAccountForApplication',
            'issueFinancialAccountForApplicationWithOnDemandFundingSource', 
            'issueFundingFinancialAccountForApplication',
            'issueEmployerFinancialAccountForCardProduct',
            'updateFinancialAccountName',
            'updateFinancialAccountBillingCycleConfiguration',
            'closeExternalFinancialBankAccount',
            'initiateFinancialAccountCreditLimitUpdateFromProductFunding'
        ],
        'queries': [
            'financialAccounts',
            'financialAccount'
        ],
        'related_types': [
            'FinancialAccount',
            'FinancialAccountConnection', 
            'FinancialAccountEdge',
            'IssueFinancialAccountFor*Input',
            'IssueFinancialAccountFor*Payload',
            'FinancialAccountStatus',
            'FinancialAccountFeature'
        ]
    },
    
    'payment_card_operations': {
        'description': 'Operations for issuing, managing, and controlling payment cards',
        'keywords': ['payment card', 'card issuance', 'card management'],
        'mutations': [
            'issuePaymentCardForApplication',
            'issuePaymentCardForApplicationWithOnDemandFundingSource',
            'issuePaymentCardForFinancialAccount',
            'issuePaymentCardForAuthorizedUserApplication',
            'issuePreprintedPaymentCardFinancialAccountForApplication',
            'reissuePaymentCard',
            'closePaymentCard',
            'suspendPaymentCard', 
            'activatePaymentCard',
            'addFundsToPaymentCard',
            'chargePaymentCard',
            'addPaymentCardToApplePayByDevicePushProvisioning',
            'addPaymentCardToGooglePayByDevicePushProvisioning'
        ],
        'queries': [
            'paymentCards',
            'paymentCard'
        ],
        'related_types': [
            'PaymentCard',
            'PaymentCardConnection',
            'PaymentCardEdge', 
            'IssuePaymentCard*Input',
            'IssuePaymentCard*Payload',
            'PaymentCardStatus',
            'PaymentCardInput',
            'ReissuePaymentCard*'
        ]
    },
    
    'account_holder_management': {
        'description': 'Operations for creating and managing account holders (persons and businesses)',
        'keywords': ['account holder', 'person', 'business', 'user management'],
        'mutations': [
            'createUSPersonAccountHolder',
            'createUSPersonAccountHolderFromToken',
            'createUSBusinessAccountHolder', 
            'createUSBusinessAccountHolderFromToken',
            'createMinimalUSBusinessAccountHolder',
            'updateUSPersonAccountHolderBillingAddress',
            'updateUSPersonAccountHolderPhone',
            'updateUSPersonAccountHolderEmail',
            'updateUSPersonAccountHolderCreditRiskAttribute',
            'updateUSBusinessAccountHolderBillingAddress',
            'updateUSBusinessAccountHolderPhone',
            'updateUSBusinessAccountHolderWebsite',
            'updateUSBusinessAccountHolderCreditRiskAttribute',
            'tokenizeUSPersonAccountHolder',
            'tokenizeUSBusinessAccountHolder'
        ],
        'queries': [
            'personAccountHolders',
            'businessAccountHolders'
        ],
        'related_types': [
            'USPersonAccountHolder',
            'USBusinessAccountHolder',
            'PersonAccountHolderConnection',
            'BusinessAccountHolderConnection',
            'Create*AccountHolder*Input',
            'Update*AccountHolder*Input',
            'AccountHolderStatus'
        ]
    },
    
    'authorized_user_management': {
        'description': 'Operations for managing authorized users on accounts',
        'keywords': ['authorized user', 'user authorization', 'permissions'],
        'mutations': [
            'createUSPersonAuthorizedUser',
            'createUSPersonAuthorizedUserFromToken',
            'updateUSPersonAuthorizedUserBillingAddress',
            'updateUSPersonAuthorizedUserPhone', 
            'updateUSPersonAuthorizedUserEmail',
            'tokenizeUSPersonAuthorizedUser'
        ],
        'queries': [
            'personAuthorizedUsers'
        ],
        'related_types': [
            'USPersonAuthorizedUser',
            'PersonAuthorizedUserConnection',
            'Create*AuthorizedUser*Input',
            'Update*AuthorizedUser*Input'
        ]
    },
    
    'spend_rules_and_controls': {
        'description': 'Operations for creating and managing spending rules and velocity controls',
        'keywords': ['spend rule', 'velocity rule', 'controls', 'limits'],
        'mutations': [
            'createAmountLimitSpendRule',
            'createCountLimitSpendRule', 
            'createCVVSpendRule',
            'createMerchantCategorySpendRule',
            'createMerchantCountrySpendRule',
            'createMerchantIdentifierSpendRule',
            'createStreetAddressSpendRule',
            'createPostalCodeVerificationSpendRule',
            'createPointOfServiceCategorySpendRule',
            'createPanEntryModeSpendRule',
            'createCardDataInputCapabilitySpendRule',
            'createCardTransactionProcessingTypeConditionSpendRule',
            'createConditionalRuleSetSpendRule',
            'createDepositAmountLimitSpendRule',
            'createDepositCountLimitSpendRule',
            'createDepositProcessingNetworkSpendRule', 
            'createMinimumAmountLimitSpendRule',
            'createMaximumAmountVarianceOnPseudoBalanceSpendRule',
            'createMaximumPercentVarianceOnPseudoBalanceSpendRule',
            'createDaysWithinAccountCreateDateSpendRule',
            'createDaysWithinCardCreateDateSpendRule',
            'createMastercardFraudScoreSpendRule',
            'createVisaRiskScoreSpendRule',
            'createVelocityRule',
            # Update operations
            'updateAmountLimitSpendRule',
            'updateCountLimitSpendRule',
            'updateCVVSpendRule',
            'updateMerchantCategorySpendRule',
            'updateMerchantCountrySpendRule', 
            'updateMerchantIdentifierSpendRule',
            'updateStreetAddressSpendRule',
            'updatePostalCodeVerificationSpendRule',
            'updatePointOfServiceCategorySpendRule',
            'updatePanEntryModeSpendRule',
            'updateCardDataInputCapabilitySpendRule',
            'updateCardTransactionProcessingTypeConditionSpendRule',
            'updateConditionalRuleSetSpendRule',
            'updateDepositAmountLimitSpendRule',
            'updateDepositCountLimitSpendRule',
            'updateDepositProcessingNetworkSpendRule',
            'updateMinimumAmountLimitSpendRule',
            'updateMaximumAmountVarianceOnPseudoBalanceSpendRule',
            'updateMaximumPercentVarianceOnPseudoBalanceSpendRule',
            'updateDaysWithinAccountCreateDateSpendRule',
            'updateDaysWithinCardCreateDateSpendRule',
            'updateMastercardFraudScoreSpendRule',
            'updateVisaRiskScoreSpendRule',
            'updateVelocityRule',
            # Delete operations
            'deleteSpendRule',
            'deleteVelocityRule',
            # Attachment operations
            'attachSpendRuleToCardProduct',
            'attachSpendRuleToPaymentCard',
            'attachVelocityRuleToCardProduct',
            'attachVelocityRuleToPaymentCard',
            'detachSpendRuleFromCardProduct',
            'detachSpendRuleFromPaymentCard',
            'detachVelocityRuleFromCardProduct',
            'detachVelocityRuleFromPaymentCard'
        ],
        'queries': [
            'spendRules',
            'velocityRules'
        ],
        'related_types': [
            'SpendRule',
            'VelocityRule',
            'SpendRuleConnection',
            'VelocityRuleConnection',
            '*SpendRuleInput',
            '*SpendRulePayload',
            'VelocityRuleInput',
            'VelocityRulePayload'
        ]
    },
    
    'card_product_management': {
        'description': 'Operations for creating and managing card products and applications',
        'keywords': ['card product', 'application', 'credit plan'],
        'mutations': [
            'createCardProduct',
            'createCardProductWithTemplate',
            'updateCardProductName',
            'createCardProductCreditPlan',
            'createCardProductInstallmentCreditPlan',
            'activateCardProductCreditPlan',
            'createRevolvingCreditCardProductConfiguration',
            'createChargeCreditCardProductConfiguration',
            'createAccountHolderCardProductApplication',
            'createAuthorizedUserCardProductApplication',
            'acceptAccountHolderCardProductApplicationOffer',
            'updateAccountHolderCardProductApplicationOffers'
        ],
        'queries': [
            'cardProducts',
            'cardProductApplications'
        ],
        'related_types': [
            'CardProduct',
            'CardProductConnection',
            'CardProductApplication',
            'Create*CardProduct*Input',
            'Update*CardProduct*Input',
            'CardProductCreditPlan'
        ]
    },
    
    'external_bank_accounts': {
        'description': 'Operations for managing external bank account connections',
        'keywords': ['external bank', 'plaid', 'finicity', 'bank connection'],
        'mutations': [
            'addExternalBankAccountFromToken',
            'addExternalBankAccountVerifiedThroughPlaid',
            'addExternalBankAccountVerifiedThroughPlaidUsingThirdPartyProcessorToken',
            'addExternalBankAccountVerifiedThroughFinicity',
            'addNonVerifiedExternalUSFinancialBankAccount',
            'generateVerifiedExternalBankAccountLinkToken'
        ],
        'queries': [
            'externalBankAccounts'
        ],
        'related_types': [
            'ExternalBankAccount',
            'ExternalBankAccountConnection',
            'Add*ExternalBankAccount*Input',
            'BankVerificationProvider'
        ]
    },
    
    'transfers_and_payments': {
        'description': 'Operations for ACH transfers, payments, and money movement',
        'keywords': ['transfer', 'ach', 'payment', 'funds'],
        'mutations': [
            'createOneTimeACHTransfer',
            'createRecurringACHTransfer',
            'createUnifiedFundsTransferQuote',
            'createPaymentOrder',
            'chargePaymentMethodToken',
            'createReusablePaymentMethodToken',
            'interFinancialAccountTransfer'
        ],
        'queries': [
            'achTransfers',
            'paymentOrders'
        ],
        'related_types': [
            'ACHTransfer',
            'PaymentOrder',
            'UnifiedFundsTransfer',
            'Create*Transfer*Input',
            'TransferStatus'
        ]
    },
    
    'notifications_and_webhooks': {
        'description': 'Operations for managing notifications and webhook endpoints',
        'keywords': ['notification', 'webhook', 'subscription'],
        'mutations': [
            'addWebhookNotificationTarget',
            'activateNotificationTarget',
            'addSubscriptionsToNotificationTarget',
            'removeSubscriptionsFromNotificationTarget'
        ],
        'queries': [
            'notificationEvents',
            'notificationTargets'
        ],
        'related_types': [
            'NotificationTarget',
            'NotificationEvent',
            'WebhookNotificationTarget'
        ]
    },
    
    'organization_and_users': {
        'description': 'Operations for managing organization settings and users',
        'keywords': ['organization', 'user', 'api key', 'settings'],
        'mutations': [
            'createSecretAPIKey',
            'revokeAPIKey',
            'updateUser',
            'inviteUser',
            'removeUser',
            'updateOrganizationProfileDisplayName'
        ],
        'queries': [
            'users',
            'organization'
        ],
        'related_types': [
            'User',
            'Organization',
            'SecretAPIKey',
            'UserRole'
        ]
    }
}

def get_operation_domain(operation_name: str) -> str:
    """
    Determine which domain an operation belongs to based on its name.
    """
    operation_lower = operation_name.lower()
    
    for domain, config in DOMAIN_OPERATIONS.items():
        for mutation in config['mutations']:
            # Support wildcard matching
            if '*' in mutation:
                pattern = mutation.replace('*', '.*')
                if re.match(pattern, operation_name, re.IGNORECASE):
                    return domain
            elif mutation.lower() == operation_lower:
                return domain
    
    # Default fallback
    return 'miscellaneous_operations'

def get_domain_keywords(domain: str) -> List[str]:
    """Get keywords associated with a domain for better retrieval."""
    return DOMAIN_OPERATIONS.get(domain, {}).get('keywords', [])

def get_domain_description(domain: str) -> str:
    """Get description for a domain."""
    return DOMAIN_OPERATIONS.get(domain, {}).get('description', '')

def get_related_types(domain: str) -> List[str]:
    """Get related GraphQL types for a domain."""
    return DOMAIN_OPERATIONS.get(domain, {}).get('related_types', [])