import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Calendar as CalendarIcon, Infinity, CheckCircle2, Trash2, TrendingUp, TrendingDown, Gift, Award } from "lucide-react";
import { format, parse, isValid, addMonths, isBefore, startOfMonth, differenceInMonths } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Commitment, CommitmentType, SalaryHistory, ExtraIncome, ManualOverride } from "../types";

interface CommitmentFormProps {
  onAdd: (commitment: Commitment) => void;
  initialData?: Commitment;
  trigger?: React.ReactNode;
}

export function CommitmentForm({ onAdd, initialData, trigger }: CommitmentFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialData?.name || "");
  const [type, setType] = useState<CommitmentType>(initialData?.type || "EMI");
  const [startDate, setStartDate] = useState<Date | undefined>(
    initialData ? new Date(initialData.startDate) : new Date()
  );
  const [dateInput, setDateInput] = useState(
    initialData ? format(new Date(initialData.startDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );
  const [amount, setAmount] = useState(initialData?.installmentAmount.toString() || "");
  const [tenure, setTenure] = useState(initialData?.totalTenureMonths?.toString() || "");
  const [isInfinite, setIsInfinite] = useState(initialData?.totalTenureMonths === null);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [loanAmount, setLoanAmount] = useState(initialData?.loanAmount?.toString() || "");
  const [interestRate, setInterestRate] = useState(initialData?.interestRate?.toString() || "");
  const [calendarMonth, setCalendarMonth] = useState<Date>(initialData?.startDate ? new Date(initialData.startDate) : new Date());

  // Sync state when dialog opens or initialData changes
  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name);
      setType(initialData.type);
      setStartDate(new Date(initialData.startDate));
      setDateInput(format(new Date(initialData.startDate), "yyyy-MM-dd"));
      setAmount(initialData.installmentAmount.toString());
      
      // For Income type, if there's history, use the latest salary as the current amount
      if (initialData.type === 'Income' && initialData.salaryHistory && initialData.salaryHistory.length > 0) {
        const sorted = [...initialData.salaryHistory].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        setAmount(sorted[0].amount.toString());
      }

      setTenure(initialData.totalTenureMonths?.toString() || "");
      setIsInfinite(initialData.totalTenureMonths === null);
      setLoanAmount(initialData.loanAmount?.toString() || "");
      setInterestRate(initialData.interestRate?.toString() || "");
      setSalaryHistory(initialData.salaryHistory || []);
      setExtraIncomes(initialData.extraIncomes || []);
      setManualOverrides(initialData.manualOverrides || []);
      setCalendarMonth(new Date(initialData.startDate));
    }
  }, [open, initialData]);

  // Salary History & Extra Income
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistory[]>(initialData?.salaryHistory || []);
  const [extraIncomes, setExtraIncomes] = useState<ExtraIncome[]>(initialData?.extraIncomes || []);
  const [manualOverrides, setManualOverrides] = useState<ManualOverride[]>(initialData?.manualOverrides || []);

  // Inline form states
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [tempSalaryAmount, setTempSalaryAmount] = useState("");
  const [tempSalaryDate, setTempSalaryDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const [showExtraForm, setShowExtraForm] = useState(false);
  const [tempExtraAmount, setTempExtraAmount] = useState("");
  const [tempExtraDate, setTempExtraDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tempExtraType, setTempExtraType] = useState<'Bonus' | 'Award'>('Bonus');

  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [tempOverrideAmount, setTempOverrideAmount] = useState("");
  const [tempOverrideDate, setTempOverrideDate] = useState(format(new Date(), "yyyy-MM"));

  useEffect(() => {
    if (startDate) {
      setDateInput(format(startDate, "yyyy-MM-dd"));
    }
  }, [startDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !amount || (!tenure && !isInfinite)) return;

    const parsedAmount = parseFloat(amount) || 0;
    const parsedTenure = isInfinite ? null : (parseInt(tenure) || 0);

    let finalSalaryHistory = type === 'Income' ? [...salaryHistory] : undefined;
    
    if (type === 'Income') {
      if (!finalSalaryHistory || finalSalaryHistory.length === 0) {
        // Create initial history entry if none exists
        finalSalaryHistory = [{
          id: crypto.randomUUID(),
          startDate: startDate.toISOString(),
          endDate: null,
          amount: parsedAmount
        }];
      } else {
        // Sort history by date
        finalSalaryHistory.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        
        // Ensure the first entry starts at the commitment's start date
        // This fixes the issue where changing the start date doesn't update the total
        if (finalSalaryHistory.length > 0) {
          finalSalaryHistory[0] = {
            ...finalSalaryHistory[0],
            startDate: startDate.toISOString()
          };
        }
      }
    }

    let payments = [...(initialData?.payments || [])];
    if (alreadyPaid && startDate) {
      const today = startOfMonth(new Date());
      let tempDate = startOfMonth(new Date(startDate));
      
      while (isBefore(tempDate, today)) {
        const monthYear = format(tempDate, "yyyy-MM");
        const existing = payments.find(p => p.monthYear === monthYear);
        if (!existing) {
          payments.push({
            monthYear,
            status: 'paid',
            actualDate: new Date().toISOString()
          });
        } else if (existing.status === 'unpaid') {
          // If it exists but was marked unpaid, update it to paid
          existing.status = 'paid';
          existing.actualDate = new Date().toISOString();
        }
        tempDate = addMonths(tempDate, 1);
      }
    }

    const commitment: Commitment = {
      id: initialData?.id || crypto.randomUUID(),
      name,
      type,
      startDate: startDate.toISOString(),
      installmentAmount: parsedAmount,
      totalTenureMonths: parsedTenure,
      payments,
      salaryHistory: finalSalaryHistory,
      extraIncomes: type === 'Income' ? extraIncomes : undefined,
      manualOverrides: type === 'Income' ? manualOverrides : undefined,
      loanAmount: type === 'EMI' ? parseFloat(loanAmount) : undefined,
      interestRate: type === 'EMI' ? parseFloat(interestRate) : undefined,
    };

    onAdd(commitment);
    setOpen(false);
    setAlreadyPaid(false);
    if (!initialData) {
      setName("");
      setAmount("");
      setTenure("");
      setStartDate(new Date());
      setIsInfinite(false);
    }
  };

  const years = Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - 25 + i);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(props) => trigger ? (
          React.cloneElement(trigger as React.ReactElement, props)
        ) : (
          <Button {...props} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Commitment
          </Button>
        )}
      />
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit" : "Add New"} Commitment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g. House Loan, LIC, Salary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CommitmentType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMI">EMI (Loan)</SelectItem>
                <SelectItem value="Insurance">Insurance</SelectItem>
                <SelectItem value="Savings">Savings</SelectItem>
                <SelectItem value="Subscription">Subscription</SelectItem>
                <SelectItem value="Expense">Regular Expense</SelectItem>
                <SelectItem value="Income">Regular Income</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger
                render={(props) => (
                  <Button 
                    {...props}
                    variant="outline" 
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                )}
              />
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b flex gap-2">
                  <Select 
                    value={startDate?.getFullYear().toString()} 
                    onValueChange={(v) => {
                      const newDate = new Date(startDate || new Date());
                      newDate.setFullYear(parseInt(v));
                      setStartDate(newDate);
                      setCalendarMonth(newDate);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[100px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(y => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select 
                    value={startDate ? months[startDate.getMonth()] : undefined} 
                    onValueChange={(v) => {
                      const newDate = new Date(startDate || new Date());
                      newDate.setMonth(months.indexOf(v));
                      setStartDate(newDate);
                      setCalendarMonth(newDate);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[120px]">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    if (date) {
                      setStartDate(date);
                      setCalendarMonth(date);
                    }
                  }}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {type === 'Income' && (
            <Accordion type="single" collapsible className="w-full border rounded-lg px-3">
              <AccordionItem value="salary-history" className="border-b-0">
                <AccordionTrigger className="text-sm py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span>Salary Increments & History</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  <div className="space-y-2">
                    {salaryHistory.map((history) => (
                      <div key={history.id} className="flex items-center gap-2 bg-muted/50 p-2 rounded-md text-xs">
                        <div className="flex-1 grid grid-cols-2 gap-1">
                          <span className="font-medium">₹{history.amount.toLocaleString()}</span>
                          <span className="text-muted-foreground text-right">
                            {format(new Date(history.startDate), "MMM yyyy")} - {history.endDate ? format(new Date(history.endDate), "MMM yyyy") : "Present"}
                          </span>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-destructive"
                          onClick={() => setSalaryHistory(prev => prev.filter(h => h.id !== history.id))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    
                    {showSalaryForm ? (
                      <div className="space-y-2 p-2 border rounded-md bg-muted/20">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px]">Amount</Label>
                            <Input 
                              type="number" 
                              className="h-7 text-xs" 
                              value={tempSalaryAmount}
                              onChange={(e) => setTempSalaryAmount(e.target.value)}
                              placeholder="Amount"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Effective Date</Label>
                            <Input 
                              type="date" 
                              className="h-7 text-xs" 
                              value={tempSalaryDate}
                              onChange={(e) => setTempSalaryDate(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            type="button" 
                            size="sm" 
                            className="h-7 flex-1 text-xs"
                            onClick={() => {
                              if (!tempSalaryAmount || !tempSalaryDate) return;
                              const newHistory: SalaryHistory = {
                                id: crypto.randomUUID(),
                                startDate: new Date(tempSalaryDate).toISOString(),
                                endDate: null,
                                amount: parseFloat(tempSalaryAmount)
                              };
                              setSalaryHistory(prev => {
                                let currentHistory = [...prev];
                                const incrementDate = new Date(tempSalaryDate);
                                
                                if (currentHistory.length === 0) {
                                  // Add the initial period entry (from joining date to this increment)
                                  currentHistory.push({
                                    id: crypto.randomUUID(),
                                    startDate: startDate.toISOString(),
                                    endDate: incrementDate.toISOString(),
                                    amount: parseFloat(amount)
                                  });
                                } else {
                                  // Close the previous active entry
                                  currentHistory = currentHistory.map(h => 
                                    h.endDate === null ? { ...h, endDate: incrementDate.toISOString() } : h
                                  );
                                }
                                
                                const newList = [...currentHistory, newHistory];
                                // Update main amount to latest salary
                                setAmount(newHistory.amount.toString());
                                return newList;
                              });
                              setShowSalaryForm(false);
                              setTempSalaryAmount("");
                            }}
                          >
                            Add
                          </Button>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 flex-1 text-xs"
                            onClick={() => setShowSalaryForm(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="w-full h-8 text-xs gap-1"
                        onClick={() => setShowSalaryForm(true)}
                      >
                        <Plus className="h-3 w-3" /> Add Increment
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="extra-income" className="border-b-0">
                <AccordionTrigger className="text-sm py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" />
                    <span>Bonuses & Awards</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  <div className="space-y-2">
                    {extraIncomes.map((extra) => (
                      <div key={extra.id} className="flex items-center gap-2 bg-muted/50 p-2 rounded-md text-xs">
                        <div className="flex-1 grid grid-cols-2 gap-1">
                          <div className="flex items-center gap-1">
                            {extra.type === 'Bonus' ? <Gift className="h-3 w-3" /> : <Award className="h-3 w-3" />}
                            <span className="font-medium">₹{extra.amount.toLocaleString()}</span>
                          </div>
                          <span className="text-muted-foreground text-right">
                            {format(new Date(extra.date), "MMM yyyy")}
                          </span>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-destructive"
                          onClick={() => setExtraIncomes(prev => prev.filter(e => e.id !== extra.id))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}

                    {showExtraForm ? (
                      <div className="space-y-2 p-2 border rounded-md bg-muted/20">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px]">Type</Label>
                            <Select 
                              value={tempExtraType} 
                              onValueChange={(v) => setTempExtraType(v as any)}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Bonus">Bonus</SelectItem>
                                <SelectItem value="Award">Award</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Amount</Label>
                            <Input 
                              type="number" 
                              className="h-7 text-xs" 
                              value={tempExtraAmount}
                              onChange={(e) => setTempExtraAmount(e.target.value)}
                              placeholder="Amount"
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-[10px]">Date</Label>
                            <Input 
                              type="date" 
                              className="h-7 text-xs" 
                              value={tempExtraDate}
                              onChange={(e) => setTempExtraDate(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            type="button" 
                            size="sm" 
                            className="h-7 flex-1 text-xs"
                            onClick={() => {
                              if (!tempExtraAmount || !tempExtraDate) return;
                              setExtraIncomes(prev => [...prev, {
                                id: crypto.randomUUID(),
                                date: new Date(tempExtraDate).toISOString(),
                                amount: parseFloat(tempExtraAmount),
                                type: tempExtraType
                              }]);
                              setShowExtraForm(false);
                              setTempExtraAmount("");
                            }}
                          >
                            Add
                          </Button>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 flex-1 text-xs"
                            onClick={() => setShowExtraForm(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs gap-1"
                          onClick={() => {
                            setTempExtraType('Bonus');
                            setShowExtraForm(true);
                          }}
                        >
                          <Plus className="h-3 w-3" /> Add Bonus
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs gap-1"
                          onClick={() => {
                            setTempExtraType('Award');
                            setShowExtraForm(true);
                          }}
                        >
                          <Plus className="h-3 w-3" /> Add Award
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="manual-overrides" className="border-b-0">
                <AccordionTrigger className="text-sm py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-orange-500" />
                    <span>Manual Salary Overrides (Cuttings)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  <div className="space-y-2">
                    {manualOverrides.map((override) => (
                      <div key={override.id} className="flex items-center gap-2 bg-muted/50 p-2 rounded-md text-xs">
                        <div className="flex-1 grid grid-cols-2 gap-1">
                          <span className="font-medium">₹{override.amount.toLocaleString()}</span>
                          <span className="text-muted-foreground text-right">
                            {format(parse(override.monthYear, "yyyy-MM", new Date()), "MMM yyyy")}
                          </span>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-destructive"
                          onClick={() => setManualOverrides(prev => prev.filter(o => o.id !== override.id))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    
                    {showOverrideForm ? (
                      <div className="space-y-2 p-2 border rounded-md bg-muted/20">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px]">Amount</Label>
                            <Input 
                              type="number" 
                              className="h-7 text-xs" 
                              value={tempOverrideAmount}
                              onChange={(e) => setTempOverrideAmount(e.target.value)}
                              placeholder="Amount"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Month</Label>
                            <Input 
                              type="month" 
                              className="h-7 text-xs" 
                              value={tempOverrideDate}
                              onChange={(e) => setTempOverrideDate(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            type="button" 
                            size="sm" 
                            className="h-7 flex-1 text-xs"
                            onClick={() => {
                              if (!tempOverrideAmount || !tempOverrideDate) return;
                              setManualOverrides(prev => [...prev, {
                                id: crypto.randomUUID(),
                                monthYear: tempOverrideDate,
                                amount: parseFloat(tempOverrideAmount)
                              }]);
                              setShowOverrideForm(false);
                              setTempOverrideAmount("");
                            }}
                          >
                            Add Override
                          </Button>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 flex-1 text-xs"
                            onClick={() => setShowOverrideForm(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="w-full h-8 text-xs gap-1"
                        onClick={() => setShowOverrideForm(true)}
                      >
                        <Plus className="h-3 w-3" /> Add Manual Override
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {type !== 'Income' && (
            <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-lg border border-dashed">
              <Checkbox 
                id="alreadyPaid" 
                checked={alreadyPaid} 
                onCheckedChange={(checked) => setAlreadyPaid(checked as boolean)} 
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="alreadyPaid"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Already paid till last month
                </label>
                <p className="text-[10px] text-muted-foreground">
                  Automatically mark all installments from start date to last month as paid.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">{type === 'Income' ? 'Salary' : 'Monthly Installment'} (₹)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="tenure">Tenure (Months)</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className={cn("h-6 px-2 text-[10px]", isInfinite && "text-primary")}
                  onClick={() => setIsInfinite(!isInfinite)}
                >
                  <Infinity className="h-3 w-3 mr-1" /> Infinite
                </Button>
              </div>
              <Input
                id="tenure"
                type="number"
                placeholder="12"
                value={tenure}
                onChange={(e) => setTenure(e.target.value)}
                disabled={isInfinite}
                required={!isInfinite}
              />
            </div>
          </div>

          {type === 'EMI' && (
            <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border border-dashed">
              <div className="grid gap-2">
                <Label htmlFor="loanAmount" className="text-xs">Loan Amount (₹)</Label>
                <Input
                  id="loanAmount"
                  type="number"
                  placeholder="500000"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="interestRate" className="text-xs">Interest Rate (% p.a.)</Label>
                <Input
                  id="interestRate"
                  type="number"
                  step="0.1"
                  placeholder="9.5"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              {amount && tenure && !isInfinite && (
                <div className="col-span-2 text-[10px] text-muted-foreground flex justify-between px-1">
                  <span>Total Payable: ₹{(parseInt(amount) * parseInt(tenure)).toLocaleString()}</span>
                  <span>Total Interest: ₹{(parseInt(amount) * parseInt(tenure) - (parseFloat(loanAmount) || 0)).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button type="submit" className="w-full">
              {initialData ? "Update" : "Save"} Commitment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
