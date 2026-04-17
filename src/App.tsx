import React, { useState, useEffect, useMemo } from "react";
import { Commitment, CommitmentType, formatIndianCurrency } from "./types";
import { SummaryCards } from "./components/SummaryCards";
import { CommitmentCard } from "./components/CommitmentCard";
import { CommitmentForm } from "./components/CommitmentForm";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { differenceInMonths, format, isSameDay, isAfter, startOfMonth, isBefore, addMonths } from "date-fns";
import { Wallet2, Filter, TrendingUp, TrendingDown, LayoutGrid, Bell, BellDot, Download, Upload as UploadIcon, LogOut, User as UserIcon, Trash2, Loader2 } from "lucide-react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { auth, db, handleFirestoreError, OperationType, cleanObject } from "./lib/firebase";
import { onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, writeBatch, getDocs } from "firebase/firestore";
import { Login } from "./components/Login";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReseting, setIsReseting] = useState(false);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [filter, setFilter] = useState<CommitmentType | "All" | "Debt" | "Investment">("All");

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Sync with Firestore
  useEffect(() => {
    if (!user) {
      setCommitments([]);
      return;
    }

    const q = query(collection(db, "commitments"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Commitment);
      setCommitments(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "commitments");
    });

    return unsubscribe;
  }, [user]);

  // Migration from localStorage
  useEffect(() => {
    if (user && loading === false) {
      const saved = localStorage.getItem("commitments");
      if (saved) {
        const localData = JSON.parse(saved) as Commitment[];
        if (localData.length > 0) {
          toast("Migrating local data to your account...", {
            description: "We found some data in your browser. Moving it to the cloud."
          });
          
          const batch = writeBatch(db);
          localData.forEach((c) => {
            const docRef = doc(db, "commitments", c.id);
            batch.set(docRef, cleanObject({ ...c, userId: user.uid }));
          });
          
          batch.commit().then(() => {
            localStorage.removeItem("commitments");
            toast.success("Migration complete!");
          }).catch(err => {
            console.error("Migration failed", err);
          });
        }
      }
    }
  }, [user, loading]);

  const addCommitment = async (newCommitment: Commitment) => {
    if (!user) return;
    try {
      const commitmentWithUser = cleanObject({ ...newCommitment, userId: user.uid });
      await setDoc(doc(db, "commitments", newCommitment.id), commitmentWithUser);
      toast.success("Commitment added!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "commitments");
    }
  };

  const updateCommitment = async (updated: Commitment) => {
    if (!user) return;
    try {
      const cleaned = cleanObject({ ...updated, userId: user.uid });
      await setDoc(doc(db, "commitments", updated.id), cleaned);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `commitments/${updated.id}`);
    }
  };

  const deleteCommitment = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "commitments", id));
      toast.success("Commitment deleted");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `commitments/${id}`);
    }
  };

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
    let salaryTotal = 0;
    let awardTotal = 0;
    let bonusTotal = 0;
    
    // Breakdown for remaining
    let remainingDebt = 0;
    let remainingInvestment = 0;
    let remainingInsurance = 0;

    const outflowDetails: { name: string; amount: number }[] = [];

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
        outflowDetails.push({ name: c.name, amount: c.installmentAmount });
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
          c.extraIncomes.forEach(e => {
            paid += e.amount;
            if (e.type === 'Award') awardTotal += e.amount;
            if (e.type === 'Bonus') bonusTotal += e.amount;
          });
        }
        salaryTotal += (paid - (c.extraIncomes?.reduce((acc, e) => acc + e.amount, 0) || 0));
        totalReceivedIncome += paid;
      } else {
        paid = finalMonthsPaid * c.installmentAmount;
      }
      
      if (!isInfinite) {
        const totalValue = (c.totalTenureMonths as number) * c.installmentAmount;
        const remaining = totalValue - paid;
        overallPaid += paid;
        overallRemaining += remaining;

        // Remaining Breakdown
        if (['EMI', 'Expense'].includes(c.type)) remainingDebt += remaining;
        if (c.type === 'RD') remainingInvestment += remaining;
        if (c.type === 'Insurance') remainingInsurance += remaining;
      } else if (c.type !== 'Income') {
        overallPaid += paid;
      }
    });

    return { 
      totalMonthlyOutflow, 
      totalMonthlyInflow, 
      overallPaid, 
      overallRemaining, 
      totalReceivedIncome,
      salaryTotal,
      awardTotal,
      bonusTotal,
      remainingDebt,
      remainingInvestment,
      remainingInsurance,
      outflowDetails
    };
  }, [commitments]);

  const handleExportData = () => {
    const dataStr = JSON.stringify(commitments, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `fintrack_data_${format(new Date(), 'yyyy-MM-dd')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    toast.success("Data exported successfully!");
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') throw new Error("Could not read file content");
        
        const importedData = JSON.parse(result);
        if (Array.isArray(importedData)) {
          console.log("Starting import for", importedData.length, "items");
          
          // Firestore batch limit is 500 operations.
          const CHUNK_SIZE = 450;
          let totalImported = 0;

          for (let i = 0; i < importedData.length; i += CHUNK_SIZE) {
            const chunk = importedData.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            let chunkCount = 0;

            chunk.forEach((c) => {
              if (!c.name) return; // Skip invalid items
              
              const baseId = c.id ? String(c.id).replace(/\//g, '-') : crypto.randomUUID();
              const docRef = doc(db, "commitments", baseId);
              
              const dataToSet = cleanObject({ 
                ...c, 
                id: baseId,
                userId: user.uid,
                startDate: c.startDate || new Date().toISOString()
              });
              
              batch.set(docRef, dataToSet);
              chunkCount++;
            });

            if (chunkCount > 0) {
              await batch.commit();
              totalImported += chunkCount;
            }
          }
          
          if (totalImported > 0) {
            toast.success(`${totalImported} records imported successfully!`);
          } else {
            toast.error("No valid records found in the file.");
          }
        } else {
          toast.error("Invalid data format. Expected an array of commitments.");
        }
      } catch (err: any) {
        console.error("Import error detail:", err);
        // Use standard error handler for logging security info
        try {
          handleFirestoreError(err, OperationType.WRITE, "import-batch");
        } catch (wrappedErr) {
          console.error("Wrapped error for logging:", wrappedErr);
        }
        toast.error(`Import failed: Check console for security details`);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleResetData = async () => {
    if (!user || commitments.length === 0) {
      toast.info("No data to reset.");
      return;
    }
    
    // Using native confirm for a blocking safety check
    if (window.confirm("Are you sure you want to delete ALL your data? This action is permanent and cannot be undone. This only affects YOUR records.")) {
      setIsReseting(true);
      try {
        const batch = writeBatch(db);
        let count = 0;
        
        // Double check owner UID in the loop
        commitments.forEach((c) => {
          if (c.userId === user.uid) {
            const docRef = doc(db, "commitments", c.id);
            batch.delete(docRef);
            count++;
          }
        });
        
        if (count > 0) {
          await batch.commit();
          
          // Background verification: Check if any records still exist for this user
          const verificationQuery = query(collection(db, "commitments"), where("userId", "==", user.uid));
          const verifySnap = await getDocs(verificationQuery);
          
          if (verifySnap.empty) {
            toast.success("All your personal records have been securely removed.");
          } else {
            console.warn("Verification showed remaining some records after batch delete.");
            toast.error("Some records might remain. Please refresh if needed.");
          }
        } else {
          toast.info("No personal data found associated with your account.");
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, "reset-data-all");
        toast.error("Failed to reset data accurately. Please try again.");
      } finally {
        setIsReseting(false);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await firebaseSignOut(auth);
      toast.success("Signed out");
    } catch (error) {
      toast.error("Error signing out");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Toaster />
        <Login />
      </>
    );
  }

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
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => document.getElementById('import-input')?.click()} className="flex items-center gap-2 h-9 rounded-xl">
                <UploadIcon className="h-4 w-4" />
                Import
              </Button>
              <input 
                id="import-input"
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
              <Button variant="outline" size="sm" onClick={handleExportData} className="flex items-center gap-2 h-9 rounded-xl">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(
                buttonVariants({ variant: "outline", size: "icon" }),
                "h-9 w-9 rounded-xl overflow-hidden border-primary/20 bg-primary/5 hover:bg-primary/10 flex items-center justify-center p-0"
              )}>
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || "User"} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-5 w-5 text-primary" />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl border-none p-1">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold truncate">{user.displayName || "My Account"}</span>
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-muted/50" />
                <DropdownMenuItem 
                  onClick={handleResetData} 
                  disabled={isReseting}
                  className="rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2 py-2"
                >
                  {isReseting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {isReseting ? "Erasing Data..." : "Reset all data"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="rounded-lg text-muted-foreground hover:text-foreground cursor-pointer gap-2 py-2">
                  <LogOut className="h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
        </div>
      </footer>
    </div>
  );
}
