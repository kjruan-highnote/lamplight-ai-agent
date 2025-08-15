import { Workflow } from '../types';

export const sampleWorkflows: Record<string, Workflow> = {
  card_issuance: {
    name: "Card Issuance",
    description: "Complete workflow for issuing a new payment card",
    required: true,
    steps: [
      {
        operation: "createAccountHolder",
        required: true,
        description: "Create the account holder in the system"
      },
      {
        operation: "performKYC",
        required: true,
        description: "Perform Know Your Customer verification"
      },
      {
        operation: "createPaymentCard",
        required: true,
        description: "Create the virtual payment card"
      },
      {
        operation: "activateCard",
        required: false,
        description: "Activate the card for transactions"
      }
    ]
  },
  transaction_processing: {
    name: "Transaction Processing",
    description: "Handle payment card transactions",
    required: true,
    steps: [
      {
        operation: "authorizeTransaction",
        required: true,
        description: "Authorize the transaction amount"
      },
      {
        operation: "captureTransaction",
        required: true,
        description: "Capture the authorized amount"
      },
      {
        operation: "settleTransaction",
        required: false,
        description: "Settle the transaction with the network"
      }
    ]
  },
  account_management: {
    name: "Account Management",
    description: "Manage account holder information and status",
    required: false,
    steps: [
      {
        operation: "updateAccountHolder",
        required: false,
        description: "Update account holder information"
      },
      {
        operation: "suspendAccount",
        required: false,
        description: "Suspend account if needed"
      },
      {
        operation: "closeAccount",
        required: false,
        description: "Close the account"
      }
    ]
  }
};