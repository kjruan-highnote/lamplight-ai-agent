# Initial Setup Workflow Template

Program: ap_automation

## Template Variables

Replace the following placeholders with actual values:

- `{{CUSTOMER_NAME}}`: Your customer/subscriber name (e.g., TripLink.com)
- `{{VENDOR_NAME}}`: The vendor name (e.g., Highnote)
- `{{WEBHOOK_SERVICE}}`: Webhook service name if applicable
- `{{EXTERNAL_SERVICE}}`: External service name if applicable
- `{{AUTH_SERVICE}}`: Authentication service name if applicable
- `{{PAYMENT_PROCESSOR}}`: Payment processor name if applicable

## Diagram

```mermaid
sequenceDiagram
    autonumber
    title Initial Setup

    %%{init: {'theme':'base'}}%%
    
    %% Participant Aliases - Replace these with actual names
    participant CUSTOMER as {{CUSTOMER_NAME}}
    participant VENDOR as {{VENDOR_NAME}}

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
