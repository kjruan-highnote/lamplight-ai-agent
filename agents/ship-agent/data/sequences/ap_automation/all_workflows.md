# All Workflows for ap_automation

Generated: 2025-08-08 08:54:41

## Initial Setup

```mermaid
sequenceDiagram
    autonumber
    title Initial Setup
    participant Client
    participant Highnote

    Note over Client: One-time setup for new organizations

    Client->>+Highnote: CreateSecretApiKey [Required]
    Note right of Highnote: Create API credentials...
    Highnote-->>-Client: Created (201)

    Client->>+Highnote: CreateCardProduct [Required]
    Note right of Highnote: Setup card product...
    Highnote-->>-Client: Created (201)

    Client->>+Highnote: CreateCardProductWithTemplate
    Note right of Highnote: Alternative setup with template...
    Highnote-->>-Client: Created (201)

    Note over Client,Highnote: Workflow Complete
```

---

## Customer Onboarding

```mermaid
sequenceDiagram
    autonumber
    title Customer Onboarding
    participant Client
    participant Highnote

    Note over Client: Onboard new card program

    Client->>+Highnote: CreateCardProduct [Required]
    Highnote-->>-Client: Created (201)

    Client->>+Highnote: GetCardProductAccounts [Required]
    Highnote-->>-Client: Data Response (200)

    alt if using on-demand funding
        Client->>+Highnote: EnableOnDemandFundingFeature
        Highnote-->>-Client: Activated (200)
    end

    alt if using collaborative auth
        Client->>+Highnote: EnableCollaborativeAuthorizationFeature
        Highnote-->>-Client: Activated (200)
    end

    Note over Client,Highnote: Workflow Complete
```

---

## Card Issuance Flow

```mermaid
sequenceDiagram
    autonumber
    title Card Issuance Flow
    participant Client
    participant Highnote

    Note over Client: Issue and activate virtual cards

    Client->>+Highnote: IssuePaymentCardForApplicationWithOnDemandFundingSource [Required]
    Highnote-->>-Client: Success (200)

    Client->>+Highnote: ActivatePaymentCard [Required]
    Highnote-->>-Client: Activated (200)

    alt if spend controls needed
        Client->>+Highnote: AttachSpendRule
        Highnote-->>-Client: Success (200)
    end

    Note over Client,Highnote: Workflow Complete
```

---

## Transaction Processing

```mermaid
sequenceDiagram
    autonumber
    title Transaction Processing
    participant Client
    participant Highnote
    participant Webhook

    Note over Client: Process card transactions

    alt sandbox only
        Client->>+Highnote: SimulateAuthorization
        Highnote-->>-Client: Simulation Complete
    end

    alt sandbox only
        Client->>+Highnote: SimulateClearing
        Highnote-->>-Client: Simulation Complete
    end

    Client->>+Webhook: GetTransactionEvent [Required]
    Webhook-->>-Client: Data Response (200)

    Client->>+Webhook: TransactionEventsByPaymentCardAndTransactionId [Required]
    Webhook-->>-Client: Success (200)

    Note over Client,Highnote: Workflow Complete
```

---

## Card Lifecycle Management

```mermaid
sequenceDiagram
    autonumber
    title Card Lifecycle Management
    participant Client
    participant Highnote

    Note over Client: Manage card states

    Client->>+Highnote: ActivatePaymentCard [Required]
    Highnote-->>-Client: Activated (200)

    Client->>+Highnote: SuspendPaymentCard [Required]
    Highnote-->>-Client: Suspended (200)

    Client->>+Highnote: ClosePaymentCard [Required]
    Highnote-->>-Client: Success (200)

    Note over Client,Highnote: Workflow Complete
```

---

