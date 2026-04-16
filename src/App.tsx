import React, { useState, useEffect, useMemo } from "react";
import { Commitment, CommitmentType, formatIndianCurrency } from "./types";
import { SummaryCards } from "./components/SummaryCards";
import { CommitmentCard } from "./components/CommitmentCard";
import { CommitmentForm } from "./components/CommitmentForm";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { differenceInMonths, format, isSameDay, isAfter, startOfMonth, isBefore, addMonths } from "date-fns";
import { Wallet2, Filter, TrendingUp, TrendingDown, LayoutGrid, Bell, BellDot } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export default function App() {
  const [commitments, setCommitments] = useState<Commitment[]>(() => {
    const saved = localStorage.getItem("commitments");
    return saved ? JSON.parse(saved) : [];
  });
  const [filter, setFilter] = useState<CommitmentType | "All" | "Debt" | "Investment">("All");

  useEffect(() => {
    localStorage.setItem("commitments", JSON.stringify(commitments));
  }, [commitments]);

  // Notification Logic
  const notifications = useMemo(() => {
    // Get current time in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const currentDay = istDate.getUTCDate();
    const currentMonthYear = format(istDate, "yyyy-MM");

    return commitments.filter(c => {
      const startDate = new Date(c.startDate);
      const startDay = startDate.getDate();
      const alreadyPaid = c.payments?.some(p => p.monthYear === currentMonthYear && p.status === 'paid');
      
      // If today is the start day (or later) and not paid yet
      return currentDay >= startDay && !alreadyPaid;
    });
  }, [commitments]);

  useEffect(() => {
    if (notifications.length > 0) {
      toast(`You have ${notifications.length} pending commitments for today!`, {
        description: "Check the notification center to mark them as paid.",
        action: {
          label: "View",
          onClick: () => document.getElementById('notif-trigger')?.click()
        }
      });
    }
  }, [notifications.length]);

  const addCommitment = (newCommitment: Commitment) => {
    setCommitments((prev) => [...prev, newCommitment]);
  };

  const updateCommitment = (updated: Commitment) => {
    setCommitments((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  const deleteCommitment = (id: string) => {
    setCommitments((prev) => prev.filter((c) => c.id !== id));
  };

  const togglePayment = (commitment: Commitment) => {
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
    
    updateCommitment({ ...commitment, payments: newPayments });
  };

  const filteredCommitments = useMemo(() => {
    if (filter === "All") return commitments;
    if (filter === "Debt") return commitments.filter(c => ['EMI', 'Expense'].includes(c.type));
    if (filter === "Investment") return commitments.filter(c => ['RD', 'Income'].includes(c.type));
    return commitments.filter((c) => c.type === filter);
  }, [commitments, filter]);

  const totals = useMemo(() => {
    const today = new Date();
    let totalMonthlyOutflow = 0;
    let totalMonthlyInflow = 0;
    let overallPaid = 0;
    let overallRemaining = 0;
    let totalReceivedIncome = 0;

    commitments.forEach((c) => {
      // Outflow vs Inflow
      if (['Income'].includes(c.type)) {
        let currentSalary = c.installmentAmount;
        if (c.salaryHistory && c.salaryHistory.length > 0) {
          // Find the salary history entry that is currently active (endDate is null or in the future)
          const activeSalary = c.salaryHistory.find(h => {
            const hStart = new Date(h.startDate);
            const hEnd = h.endDate ? new Date(h.endDate) : null;
            return today >= hStart && (hEnd === null || today <= hEnd);
          });
          if (activeSalary) {
            currentSalary = activeSalary.amount;
          } else {
            // Fallback to the latest one if none are currently active (e.g. all in past)
            const sorted = [...c.salaryHistory].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
            if (sorted.length > 0) currentSalary = sorted[0].amount;
          }
        }
        totalMonthlyInflow += currentSalary;
      } else {
        // Include RD in outflow for "Remaining Salary" calculation as it's a monthly commitment
        totalMonthlyOutflow += c.installmentAmount;
      }
      
      const start = new Date(c.startDate);
      const manualPaidCount = c.payments?.filter(p => p.status === 'paid').length || 0;
      
      // Automatic calculation for legacy or initial display
      let autoMonthsPaid = differenceInMonths(today, start);
      if (today.getDate() >= start.getDate()) {
        autoMonthsPaid += 1;
      }
      if (autoMonthsPaid < 0) autoMonthsPaid = 0;

      // Prioritize manual tracking
      const monthsPaid = c.payments?.length > 0 ? manualPaidCount : autoMonthsPaid;
      
      const isInfinite = c.totalTenureMonths === null;
      const finalMonthsPaid = (!isInfinite && monthsPaid > (c.totalTenureMonths as number)) 
        ? (c.totalTenureMonths as number) 
        : monthsPaid;

      let paid = 0;
      if (c.type === 'Income') {
        const startMonth = startOfMonth(new Date(c.startDate));
        const currentMonth = startOfMonth(today);
        let tempDate = startMonth;
        
        while (isBefore(tempDate, currentMonth) || isSameDay(tempDate, currentMonth)) {
          const monthYear = format(tempDate, "yyyy-MM");
          
          // Check for manual override
          const override = c.manualOverrides?.find(o => o.monthYear === monthYear);
          if (override) {
            paid += override.amount;
          } else {
            // Find applicable salary from history
            let monthlySalary = c.installmentAmount;
            if (c.salaryHistory && c.salaryHistory.length > 0) {
              const activeSalary = c.salaryHistory.find(h => {
                const hStart = startOfMonth(new Date(h.startDate));
                const hEnd = h.endDate ? startOfMonth(new Date(h.endDate)) : null;
                // Active if tempDate is >= hStart AND (hEnd is null OR tempDate < hEnd)
                return (isSameDay(tempDate, hStart) || isAfter(tempDate, hStart)) && 
                       (hEnd === null || isBefore(tempDate, hEnd));
              });
              if (activeSalary) monthlySalary = activeSalary.amount;
            }
            paid += monthlySalary;
          }
          tempDate = addMonths(tempDate, 1);
        }
        
        // Add extra incomes
        if (c.extraIncomes) {
          c.extraIncomes.forEach(e => paid += e.amount);
        }
        totalReceivedIncome += paid;
      } else {
        paid = finalMonthsPaid * c.installmentAmount;
      }
      
      if (!isInfinite) {
        const totalValue = (c.totalTenureMonths as number) * c.installmentAmount;
        overallPaid += paid;
        overallRemaining += (totalValue - paid);
      } else if (c.type !== 'Income') {
        overallPaid += paid;
      }
    });

    // Special case: Add current remaining salary to "overallPaid" if we want to track it as "saved"
    // But the user said "Total saved in salary commitment is not getting updated with the remaining salary"
    // This implies the "Salary" commitment's "Total Paid" should reflect the accumulation.
    // The current logic already does this via 'finalMonthsPaid * installmentAmount'.

    return { totalMonthlyOutflow, totalMonthlyInflow, overallPaid, overallRemaining, totalReceivedIncome };
  }, [commitments]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-foreground font-sans selection:bg-primary/10">
      <Toaster />
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg">
              <Wallet2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">FinTrack</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger render={(props) => (
                <Button {...props} variant="ghost" size="icon" className="relative" id="notif-trigger">
                  {notifications.length > 0 ? (
                    <BellDot className="h-5 w-5 text-primary animate-pulse" />
                  ) : (
                    <Bell className="h-5 w-5 text-muted-foreground" />
                  )}
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                      {notifications.length}
                    </span>
                  )}
                </Button>
              )} />
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Notifications</SheetTitle>
                  <SheetDescription>
                    Track your pending payments for this month.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  {notifications.length > 0 ? (
                    notifications.map(c => (
                      <div key={c.id} className="p-4 rounded-xl border bg-muted/30 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{c.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.type === 'Income' ? 'Expected Income' : 'Pending Expense'} • {formatIndianCurrency(c.installmentAmount)}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {format(new Date(new Date().getFullYear(), new Date().getMonth(), new Date(c.startDate).getDate()), "do MMM")}
                          </Badge>
                        </div>
                        <p className="text-sm">
                          {c.type === 'Income' ? `Have you got the ${c.name}?` : `Have you paid the ${c.name}?`}
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1" onClick={() => togglePayment(c)}>Yes</Button>
                          <Button size="sm" variant="outline" className="flex-1">No</Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Bell className="h-10 w-10 text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">All caught up!</p>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
            <CommitmentForm onAdd={addCommitment} />
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 space-y-8">
        <section className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold tracking-tight">Financial Overview</h2>
            <p className="text-muted-foreground">Track your progress and upcoming installments.</p>
          </div>
          <SummaryCards {...totals} />
        </section>

        <Separator className="my-8" />

        <section className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Commitments</h3>
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full lg:w-auto">
              <TabsList className="grid w-full grid-cols-3 h-9">
                <TabsTrigger value="All" className="text-xs gap-1">
                  <LayoutGrid className="h-3 w-3 hidden sm:inline" /> All
                </TabsTrigger>
                <TabsTrigger value="Debt" className="text-xs gap-1">
                  <TrendingDown className="h-3 w-3 hidden sm:inline text-red-500" /> Debts
                </TabsTrigger>
                <TabsTrigger value="Investment" className="text-xs gap-1">
                  <TrendingUp className="h-3 w-3 hidden sm:inline text-green-500" /> Invest
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {filteredCommitments.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredCommitments.map((commitment) => (
                <CommitmentCard
                  key={commitment.id}
                  commitment={commitment}
                  onUpdate={updateCommitment}
                  onDelete={deleteCommitment}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-3xl bg-background/50">
              <div className="bg-muted p-4 rounded-full mb-4">
                <Wallet2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No commitments found</h3>
              <p className="text-muted-foreground max-w-xs mx-auto mt-1">
                {filter === "All" 
                  ? "Start by adding your first financial commitment." 
                  : `You don't have any ${filter} commitments yet.`}
              </p>
              {filter === "All" && (
                <div className="mt-6">
                  <CommitmentForm onAdd={addCommitment} />
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t py-6 md:py-0 mt-20">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row px-4">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built with precision for your financial clarity. Data is stored locally in your browser.
          </p>
        </div>
      </footer>
    </div>
  );
}
