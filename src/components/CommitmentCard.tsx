import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Calendar, Clock, IndianRupee, Infinity, CheckCircle2, XCircle, TrendingUp, Gift, Award, ChevronDown } from "lucide-react";
import { Commitment, CommitmentStats, CommitmentCategory, formatIndianCurrency } from "../types";
import { differenceInMonths, addMonths, format, isAfter, startOfMonth, isBefore, isSameDay } from "date-fns";
import { CommitmentForm } from "./CommitmentForm";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CommitmentCardProps {
  commitment: Commitment;
  onUpdate: (commitment: Commitment) => void;
  onDelete: (id: string) => void;
}

export const CommitmentCard: React.FC<CommitmentCardProps> = ({ commitment, onUpdate, onDelete }) => {
  const calculateStats = (): CommitmentStats => {
    const today = new Date();
    const start = new Date(commitment.startDate);
    
    // Count payments marked as 'paid'
    const manualPaidCount = commitment.payments?.filter(p => p.status === 'paid').length || 0;
    
    // For automatic calculation (legacy or fallback)
    let autoMonthsPaid = differenceInMonths(today, start);
    if (today.getDate() >= start.getDate()) {
      autoMonthsPaid += 1;
    }
    if (autoMonthsPaid < 0) autoMonthsPaid = 0;

    // We prioritize manual tracking if payments exist, otherwise fallback to auto
    const monthsPaid = commitment.payments?.length > 0 ? manualPaidCount : autoMonthsPaid;
    
    const isInfinite = commitment.totalTenureMonths === null;
    const finalMonthsPaid = (!isInfinite && monthsPaid > (commitment.totalTenureMonths as number)) 
      ? (commitment.totalTenureMonths as number) 
      : monthsPaid;

    let totalPaid = 0;
    if (commitment.type === 'Income') {
      const startMonth = startOfMonth(new Date(commitment.startDate));
      const currentMonth = startOfMonth(today);
      let tempDate = startMonth;
      
      while (isBefore(tempDate, currentMonth) || isSameDay(tempDate, currentMonth)) {
        const monthYear = format(tempDate, "yyyy-MM");
        
        // Check for manual override
        const override = commitment.manualOverrides?.find(o => o.monthYear === monthYear);
        if (override) {
          totalPaid += override.amount;
        } else {
          // Find applicable salary from history
          let monthlySalary = commitment.installmentAmount;
          if (commitment.salaryHistory && commitment.salaryHistory.length > 0) {
            const activeSalary = commitment.salaryHistory.find(h => {
              const hStart = startOfMonth(new Date(h.startDate));
              const hEnd = h.endDate ? startOfMonth(new Date(h.endDate)) : null;
              return (isSameDay(tempDate, hStart) || isAfter(tempDate, hStart)) && 
                     (hEnd === null || isBefore(tempDate, hEnd));
            });
            if (activeSalary) monthlySalary = activeSalary.amount;
          }
          totalPaid += monthlySalary;
        }
        tempDate = addMonths(tempDate, 1);
      }

      if (commitment.extraIncomes) {
        commitment.extraIncomes.forEach(e => totalPaid += e.amount);
      }
    } else {
      totalPaid = finalMonthsPaid * commitment.installmentAmount;
    }

    const remainingMonths = isInfinite ? null : (commitment.totalTenureMonths as number) - finalMonthsPaid;
    const totalTenureYears = isInfinite ? null : (commitment.totalTenureMonths as number) / 12;

    let timeLeftFormatted = "N/A";
    if (!isInfinite) {
      const rem = remainingMonths as number;
      const yearsLeft = Math.floor(rem / 12);
      const monthsLeft = rem % 12;
      timeLeftFormatted = rem > 0 
        ? `${yearsLeft > 0 ? `${yearsLeft} Year${yearsLeft > 1 ? 's' : ''} ` : ''}${monthsLeft > 0 ? `${monthsLeft} Month${monthsLeft > 1 ? 's' : ''}` : ''}`.trim()
        : "Completed";
    } else {
      timeLeftFormatted = "Ongoing";
    }

    const progressPercentage = isInfinite ? 100 : (finalMonthsPaid / (commitment.totalTenureMonths as number)) * 100;

    let category: CommitmentCategory = 'Regular';
    if (['EMI', 'Expense'].includes(commitment.type)) category = 'Debt';
    if (['RD', 'Income'].includes(commitment.type)) category = 'Investment';

    const totalValue = isInfinite ? null : (commitment.totalTenureMonths as number) * commitment.installmentAmount;
    const remainingAmount = totalValue !== null ? totalValue - totalPaid : null;

    return {
      monthsPaid: finalMonthsPaid,
      totalPaid,
      totalValue,
      remainingAmount,
      remainingMonths,
      totalTenureYears,
      timeLeftFormatted,
      progressPercentage,
      category
    };
  };

  const stats = calculateStats();

  const currentSalary = React.useMemo(() => {
    if (commitment.type !== 'Income') return commitment.installmentAmount;
    if (!commitment.salaryHistory || commitment.salaryHistory.length === 0) return commitment.installmentAmount;
    
    const today = new Date();
    const activeSalary = commitment.salaryHistory.find(h => {
      const hStart = new Date(h.startDate);
      const hEnd = h.endDate ? new Date(h.endDate) : null;
      return today >= hStart && (hEnd === null || today <= hEnd);
    });
    
    if (activeSalary) return activeSalary.amount;
    
    // Fallback to latest
    const sorted = [...commitment.salaryHistory].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    return sorted[0]?.amount || commitment.installmentAmount;
  }, [commitment]);

  const getCategoryStyles = (category: CommitmentCategory) => {
    switch (category) {
      case 'Debt': return 'border-l-4 border-l-red-500 bg-red-50/30';
      case 'Investment': return 'border-l-4 border-l-green-500 bg-green-50/30';
      case 'Regular': return 'border-l-4 border-l-blue-500 bg-blue-50/30';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'EMI': return 'bg-red-100 text-red-700 border-red-200';
      case 'Expense': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Insurance': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'RD': return 'bg-green-100 text-green-700 border-green-200';
      case 'Income': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Subscription': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const currentMonthYear = format(new Date(), "yyyy-MM");
  const currentPayment = commitment.payments?.find(p => p.monthYear === currentMonthYear);

  const togglePayment = () => {
    const today = new Date();
    const monthYear = format(today, "yyyy-MM");
    const existingIndex = commitment.payments?.findIndex(p => p.monthYear === monthYear) ?? -1;
    
    let newPayments = [...(commitment.payments || [])];
    if (existingIndex >= 0) {
      const current = newPayments[existingIndex];
      newPayments[existingIndex] = {
        ...current,
        status: current.status === 'paid' ? 'unpaid' : 'paid',
        actualDate: current.status === 'paid' ? undefined : today.toISOString()
      };
    } else {
      newPayments.push({
        monthYear,
        status: 'paid',
        actualDate: today.toISOString()
      });
    }
    
    onUpdate({ ...commitment, payments: newPayments });
  };

  return (
    <Card className={`overflow-hidden border shadow-sm hover:shadow-md transition-all duration-200 ${getCategoryStyles(stats.category)}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold">{commitment.name}</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className={getTypeBadgeColor(commitment.type)}>
              {commitment.type}
            </Badge>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
              {stats.category}
            </Badge>
          </div>
        </div>
        <div className="flex gap-1">
          <CommitmentForm 
            onAdd={onUpdate} 
            initialData={commitment} 
            trigger={
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Edit2 className="h-4 w-4" />
              </Button>
            }
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(commitment.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <IndianRupee className="h-3 w-3" /> {commitment.type === 'Income' ? 'Current Salary' : 'Amount'}
            </p>
            <p className="text-sm font-semibold">{formatIndianCurrency(currentSalary)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Tenure
            </p>
            <p className="text-sm font-semibold">
              {stats.totalTenureYears !== null ? `${stats.totalTenureYears.toFixed(1)} Years` : "Infinite"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Time Left
            </p>
            <p className="text-sm font-semibold">{stats.timeLeftFormatted}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {commitment.type === 'Income' ? 'Total Received' : stats.category === 'Investment' ? 'Total Saved' : 'Total Paid'}
            </p>
            <p className="text-sm font-semibold text-primary">{formatIndianCurrency(stats.totalPaid)}</p>
          </div>
          {stats.totalValue !== null && (
            <>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="text-sm font-semibold">{formatIndianCurrency(stats.totalValue)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="text-sm font-semibold text-orange-600">{formatIndianCurrency(stats.remainingAmount || 0)}</p>
              </div>
            </>
          )}
        </div>

        {commitment.type === 'EMI' && (commitment.loanAmount || commitment.interestRate) && (
          <div className="bg-muted/30 p-2 rounded-md border border-dashed text-[10px] grid grid-cols-2 gap-2">
            {commitment.loanAmount && (
              <div>
                <span className="text-muted-foreground">Loan Amount: </span>
                <span className="font-medium">{formatIndianCurrency(commitment.loanAmount)}</span>
              </div>
            )}
            {commitment.interestRate && (
              <div className="text-right">
                <span className="text-muted-foreground">ROI: </span>
                <span className="font-medium">{commitment.interestRate}% p.a.</span>
              </div>
            )}
          </div>
        )}

        {commitment.type === 'Income' && (commitment.salaryHistory?.length || 0) > 0 && (
          <Collapsible className="space-y-2">
            <CollapsibleTrigger
              render={(props) => (
                <Button 
                  {...props}
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-between h-7 px-2 text-[10px] font-medium text-muted-foreground hover:text-primary"
                >
                  View Salary Details
                  <ChevronDown className="h-3 w-3" />
                </Button>
              )}
            />
            <CollapsibleContent className="space-y-2 pt-1">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-1">Salary History</p>
                {commitment.salaryHistory?.map(h => (
                  <div key={h.id} className="flex justify-between items-center text-[10px] bg-muted/40 p-1.5 rounded border border-muted">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                      <span className="font-medium">{formatIndianCurrency(h.amount)}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {format(new Date(h.startDate), "MMM yy")} - {h.endDate ? format(new Date(h.endDate), "MMM yy") : "Now"}
                    </span>
                  </div>
                ))}
              </div>
              
              {(commitment.extraIncomes?.length || 0) > 0 && (
                <div className="space-y-1.5 mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-1">Bonuses & Awards</p>
                  {commitment.extraIncomes?.map(e => (
                    <div key={e.id} className="flex justify-between items-center text-[10px] bg-muted/40 p-1.5 rounded border border-muted">
                      <div className="flex items-center gap-1.5">
                        {e.type === 'Bonus' ? <Gift className="h-3 w-3 text-amber-500" /> : <Award className="h-3 w-3 text-blue-500" />}
                        <span className="font-medium">{formatIndianCurrency(e.amount)}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {format(new Date(e.date), "MMM yy")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              {stats.monthsPaid} {commitment.totalTenureMonths !== null ? `of ${commitment.totalTenureMonths}` : ""} months
            </span>
            <span className="font-medium">
              {commitment.totalTenureMonths !== null ? `${stats.progressPercentage.toFixed(0)}%` : <Infinity className="h-3 w-3" />}
            </span>
          </div>
          <Progress value={stats.progressPercentage} className="h-1.5" />
        </div>

        <div className="pt-2 border-t flex items-center justify-between">
          <div className="text-xs">
            <p className="text-muted-foreground">Current Month ({format(new Date(), "MMM yyyy")})</p>
            <p className="font-medium">{currentPayment?.status === 'paid' ? 'Completed' : 'Pending'}</p>
          </div>
          <Button 
            variant={currentPayment?.status === 'paid' ? "outline" : "default"} 
            size="sm" 
            className="h-8 gap-1.5"
            onClick={togglePayment}
          >
            {currentPayment?.status === 'paid' ? (
              <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Mark Unpaid</>
            ) : (
              <><XCircle className="h-3.5 w-3.5" /> Mark Paid</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
