import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wallet, TrendingUp, Clock, Landmark } from "lucide-react";
import { formatIndianCurrency } from "../types";

interface SummaryCardsProps {
  totalMonthlyOutflow: number;
  totalMonthlyInflow: number;
  overallPaid: number;
  overallRemaining: number;
  totalReceivedIncome: number;
}

export function SummaryCards({ 
  totalMonthlyOutflow, 
  totalMonthlyInflow, 
  overallPaid, 
  overallRemaining,
  totalReceivedIncome
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
        <CardContent>
          <div className="text-2xl font-bold">{formatIndianCurrency(totalMonthlyOutflow)}</div>
          <p className="text-xs text-muted-foreground mt-1">Fixed expenses per month</p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Received Income</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">
            {formatIndianCurrency(totalReceivedIncome)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total from joining date</p>
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
          <p className="text-xs text-muted-foreground mt-2">
            {formatIndianCurrency(overallPaid)} of {formatIndianCurrency(totalValue)}
          </p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Remaining</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatIndianCurrency(overallRemaining)}</div>
          <p className="text-xs text-muted-foreground mt-1">Total future commitments</p>
        </CardContent>
      </Card>
    </div>
  );
}

import { cn } from "@/lib/utils";
