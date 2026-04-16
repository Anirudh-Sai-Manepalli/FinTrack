export type CommitmentType = 'EMI' | 'Insurance' | 'RD' | 'Subscription' | 'Expense' | 'Income';
export type CommitmentCategory = 'Debt' | 'Investment' | 'Regular';

export interface PaymentRecord {
  monthYear: string; // Format: YYYY-MM
  status: 'paid' | 'unpaid';
  actualDate?: string; // ISO string
}

export interface SalaryHistory {
  id: string;
  startDate: string;
  endDate: string | null;
  amount: number;
}

export interface ExtraIncome {
  id: string;
  date: string;
  amount: number;
  type: 'Bonus' | 'Award';
  description?: string;
}

export interface ManualOverride {
  id: string;
  monthYear: string; // YYYY-MM
  amount: number;
}

export interface Commitment {
  id: string;
  name: string;
  type: CommitmentType;
  startDate: string; // ISO string
  installmentAmount: number;
  totalTenureMonths: number | null; // null for infinite/regular recurring
  payments: PaymentRecord[];
  salaryHistory?: SalaryHistory[];
  extraIncomes?: ExtraIncome[];
  manualOverrides?: ManualOverride[];
  loanAmount?: number;
  interestRate?: number;
}

export interface CommitmentStats {
  monthsPaid: number;
  totalPaid: number;
  totalValue: number | null;
  remainingAmount: number | null;
  remainingMonths: number | null;
  totalTenureYears: number | null;
  timeLeftFormatted: string;
  progressPercentage: number;
  category: CommitmentCategory;
}

export const formatIndianNumber = (num: number) => {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(num);
};

export const formatIndianCurrency = (num: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(num);
};
