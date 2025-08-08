# Card Issuance Flow Workflow Template

Program: ap_automation

## Template Variables

Replace the following placeholders with actual values:

- `TripLink.com`: Your customer/subscriber name (e.g., TripLink.com)
- `Highnote`: The vendor name (e.g., Highnote)
- `Webhook Events`: Webhook service name if applicable
- `{{EXTERNAL_SERVICE}}`: External service name if applicable
- `{{AUTH_SERVICE}}`: Authentication service name if applicable
- `{{PAYMENT_PROCESSOR}}`: Payment processor name if applicable

## Diagram

```mermaid
sequenceDiagram
    autonumber
    title Card Issuance Flow

    %%{init: {'theme':'base'}}%%
    
    %% Participant Aliases - Replace these with actual names
    participant CUSTOMER as TripLink.com
    participant VENDOR as Highnote
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
