import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wallet, TrendingUp, Clock, Landmark } from "lucide-react";
import { formatIndianCurrency } from "../types";

interface SummaryCardsProps {
  totalMonthlyOutflow: number;
  totalMonthlyInflow: number;
  overallPaid: number;
  overallRemaining: number;
  totalReceivedIncome: number;
  salaryTotal: number;
  awardTotal: number;
  bonusTotal: number;
  remainingDebt: number;
  remainingInvestment: number;
  remainingInsurance: number;
  outflowDetails: { name: string; amount: number }[];
}

export function SummaryCards({ 
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
}: SummaryCardsProps) {
  const totalValue = overallPaid + overallRemaining;
  const progress = totalValue > 0 ? (overallPaid / totalValue) * 100 : 0;
  const remainingSalary = totalMonthlyInflow - totalMonthlyOutflow;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card className="border-none shadow-sm bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Remaining Salary</CardTitle>
          <Landmark className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={cn("text-2xl font-bold", remainingSalary < 0 ? "text-red-600" : "text-green-600")}>
            {formatIndianCurrency(remainingSalary)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">After all fixed commitments</p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Outflow</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pb-4">
          <div className="text-2xl font-bold">{formatIndianCurrency(totalMonthlyOutflow)}</div>
          <ScrollArea className="h-[60px] mt-2 pr-2">
            <div className="space-y-1">
              {outflowDetails.map((item, idx) => (
                <div key={idx} className="flex justify-between text-[10px] text-muted-foreground">
                  <span className="truncate max-w-[100px]">{item.name}:</span>
                  <span className="font-medium text-foreground">{formatIndianCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 py-3">
          <CardTitle className="text-sm font-medium">Total Received Income</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        </CardHeader>
        <CardContent className="pb-4">
          <div className="text-2xl font-bold text-emerald-600">
            {formatIndianCurrency(totalReceivedIncome)}
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Salary:</span>
              <span className="font-medium text-foreground">{formatIndianCurrency(salaryTotal)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Awards:</span>
              <span className="font-medium text-foreground">{formatIndianCurrency(awardTotal)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Bonus:</span>
              <span className="font-medium text-foreground">{formatIndianCurrency(bonusTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Financial Progress</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{progress.toFixed(1)}%</div>
          <Progress value={progress} className="h-2 mt-2" />
          <p className="text-[10px] text-muted-foreground mt-2">
            Paid till now: <span className="font-medium text-foreground">{formatIndianCurrency(overallPaid)}</span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            Total Target: <span className="font-medium text-foreground">{formatIndianCurrency(totalValue)}</span>
          </p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 py-3">
          <CardTitle className="text-sm font-medium">Total Remaining</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pb-4">
          <div className="text-2xl font-bold">{formatIndianCurrency(overallRemaining)}</div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Debt:</span>
              <span className="font-medium text-foreground">{formatIndianCurrency(remainingDebt)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Investment:</span>
              <span className="font-medium text-foreground">{formatIndianCurrency(remainingInvestment)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Insurance:</span>
              <span className="font-medium text-foreground">{formatIndianCurrency(remainingInsurance)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { cn } from "@/lib/utils";
