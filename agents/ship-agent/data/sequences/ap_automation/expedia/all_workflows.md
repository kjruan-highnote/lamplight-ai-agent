# All Workflow Templates for ap_automation

Generated: 2025-08-08 08:58:27

## How to Use These Templates

1. Replace placeholder values in participant declarations
2. Customize operation names and descriptions as needed
3. Add or remove steps based on your specific implementation

## Template Variables

- `CUSTOMER`: Customer/Subscriber alias
- `VENDOR`: Primary vendor/service provider alias
- `WEBHOOK`: Webhook service alias (if used)
- `EXTERNAL`: External service alias (if used)

---

## Initial Setup

```mermaid
sequenceDiagram
    autonumber
    title Initial Setup

    %%{init: {'theme':'base'}}%%
    
    %% Participant Aliases - Replace these with actual names
    participant CUSTOMER as Expedia
    participant VENDOR as Stripe

    Note over CUSTOMER: One-time setup for new organizations

    CUSTOMER->>+VENDOR: CreateSecretApiKey [Required]
    Note right of VENDOR: Create API credentials...
    VENDOR-->>-CUSTOMER: Created (201)

    CUSTOMER->>+VENDOR: CreateCardProduct [Required]
    Note right of VENDOR: Setup card product...
    VENDOR-->>-CUSTOMER: Created (201)

    CUSTOMER->>+VENDOR: CreateCardProductWithTemplate
    Note right of VENDOR: Alternative setup with template...
    VENDOR-->>-CUSTOMER: Created (201)

    Note over CUSTOMER,VENDOR: Workflow Complete
```

---

## Customer Onboarding

```mermaid
sequenceDiagram
    autonumber
    title Customer Onboarding

    %%{init: {'theme':'base'}}%%
    
    %% Participant Aliases - Replace these with actual names
    participant CUSTOMER as Expedia
    participant VENDOR as Stripe
    participant AUTH as {{AUTH_SERVICE}}

    Note over CUSTOMER: Onboard new card program

    CUSTOMER->>+VENDOR: CreateCardProduct [Required]
    VENDOR-->>-CUSTOMER: Created (201)

    CUSTOMER->>+VENDOR: GetCardProductAccounts [Required]
    VENDOR-->>-CUSTOMER: Data Response (200)

    alt if using on-demand funding
        CUSTOMER->>+VENDOR: EnableOnDemandFundingFeature
        VENDOR-->>-CUSTOMER: Activated (200)
    end

    alt if using collaborative auth
        CUSTOMER->>+AUTH: EnableCollaborativeAuthorizationFeature
        AUTH-->>-CUSTOMER: Activated (200)
    end

    Note over CUSTOMER,VENDOR: Workflow Complete
```

---

## Card Issuance Flow

```mermaid
sequenceDiagram
    autonumber
    title Card Issuance Flow

    %%{init: {'theme':'base'}}%%
    
    %% Participant Aliases - Replace these with actual names
    participant CUSTOMER as Expedia
    participant VENDOR as Stripe
    participant PAYMENT as {{PAYMENT_PROCESSOR}}

    Note over CUSTOMER: Issue and activate virtual cards

    CUSTOMER->>+VENDOR: IssuePaymentCardForApplicationWithOnDemandFundingSource [Required]
    VENDOR-->>-CUSTOMER: Success (200)

    CUSTOMER->>+VENDOR: ActivatePaymentCard [Required]
    VENDOR-->>-CUSTOMER: Activated (200)

    alt if spend controls needed
        CUSTOMER->>+VENDOR: AttachSpendRule
        VENDOR-->>-CUSTOMER: Success (200)
    end

    Note over CUSTOMER,VENDOR: Workflow Complete
```

---

## Transaction Processing

```mermaid
sequenceDiagram
    autonumber
    title Transaction Processing

    %%{init: {'theme':'base'}}%%
    
    %% Participant Aliases - Replace these with actual names
    participant CUSTOMER as Expedia
    participant VENDOR as Stripe
    participant AUTH as {{AUTH_SERVICE}}
    participant WEBHOOK as {{WEBHOOK_SERVICE}}
    participant PAYMENT as {{PAYMENT_PROCESSOR}}

    Note over CUSTOMER: Process card transactions

    alt sandbox only
        CUSTOMER->>+AUTH: SimulateAuthorization
        AUTH-->>-CUSTOMER: Simulation Complete
    end

    alt sandbox only
        CUSTOMER->>+VENDOR: SimulateClearing
        VENDOR-->>-CUSTOMER: Simulation Complete
    end

    CUSTOMER->>+WEBHOOK: GetTransactionEvent [Required]
    WEBHOOK-->>-CUSTOMER: Data Response (200)

    CUSTOMER->>+WEBHOOK: TransactionEventsByPaymentCardAndTransactionId [Required]
    WEBHOOK-->>-CUSTOMER: Success (200)

    Note over CUSTOMER,VENDOR: Workflow Complete
```

---

## Card Lifecycle Management

```mermaid
sequenceDiagram
    autonumber
    title Card Lifecycle Management

    %%{init: {'theme':'base'}}%%
    
    %% Participant Aliases - Replace these with actual names
    participant CUSTOMER as Expedia
    participant VENDOR as Stripe
    participant PAYMENT as {{PAYMENT_PROCESSOR}}

    Note over CUSTOMER: Manage card states

    CUSTOMER->>+VENDOR: ActivatePaymentCard [Required]
    VENDOR-->>-CUSTOMER: Activated (200)

    CUSTOMER->>+VENDOR: SuspendPaymentCard [Required]
    VENDOR-->>-CUSTOMER: Suspended (200)

    CUSTOMER->>+VENDOR: ClosePaymentCard [Required]
    VENDOR-->>-CUSTOMER: Success (200)

    Note over CUSTOMER,VENDOR: Workflow Complete
```

---

