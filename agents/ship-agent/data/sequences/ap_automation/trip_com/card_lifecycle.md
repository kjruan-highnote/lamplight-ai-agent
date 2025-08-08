# Card Lifecycle Management Workflow Template

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
    title Card Lifecycle Management

    %%{init: {'theme':'base'}}%%
    
    %% Participant Aliases - Replace these with actual names
    participant CUSTOMER as trip_com
    participant VENDOR as Highnote
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
