# Transaction Processing Workflow Template

Program: ap_automation

## Template Variables

Replace the following placeholders with actual values:

- `trip_com`: Your customer/subscriber name (e.g., TripLink.com)
- `Highnote`: The vendor name (e.g., Highnote)
- `{{WEBHOOK_SERVICE}}`: Webhook service name if applicable
- `{{EXTERNAL_SERVICE}}`: External service name if applicable
- `{{AUTH_SERVICE}}`: Authentication service name if applicable
- `{{PAYMENT_PROCESSOR}}`: Payment processor name if applicable

## Diagram

```mermaid
sequenceDiagram
    autonumber
    title Transaction Processing

    %%{init: {'theme':'base'}}%%
    
    %% Participant Aliases - Replace these with actual names
    participant CUSTOMER as trip_com
    participant VENDOR as Highnote
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
