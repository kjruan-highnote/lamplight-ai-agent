# Customer Onboarding Workflow Template

Program: ap_automation

## Template Variables

Replace the following placeholders with actual values:

- `Expedia`: Your customer/subscriber name (e.g., TripLink.com)
- `Stripe`: The vendor name (e.g., Highnote)
- `{{WEBHOOK_SERVICE}}`: Webhook service name if applicable
- `{{EXTERNAL_SERVICE}}`: External service name if applicable
- `{{AUTH_SERVICE}}`: Authentication service name if applicable
- `{{PAYMENT_PROCESSOR}}`: Payment processor name if applicable

## Diagram

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
