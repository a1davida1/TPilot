import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Receipt,
  FileText,
  Download,
  TrendingUp,
  DollarSign,
  Package,
  Camera,
  Laptop,
  Car,
  Home,
  Plus,
  X,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Types
interface Expense {
  id: string;
  date: Date;
  category: string;
  description: string;
  amount: number;
  isDeductible: boolean;
  receipt?: string;
  notes?: string;
}

interface TaxCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  totalAmount: number;
  itemCount: number;
  color: string;
}

interface TaxSummary {
  totalExpenses: number;
  deductibleExpenses: number;
  quarterlyEstimate: number;
  ytdSavings: number;
  taxRate: number;
}

// Expense Categories
const expenseCategories: { value: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'software', label: 'Software & Subscriptions', icon: Package },
  { value: 'equipment', label: 'Equipment', icon: Camera },
  { value: 'tech', label: 'Technology', icon: Laptop },
  { value: 'travel', label: 'Travel & Transportation', icon: Car },
  { value: 'office', label: 'Office & Workspace', icon: Home },
  { value: 'marketing', label: 'Marketing & Advertising', icon: TrendingUp },
  { value: 'services', label: 'Professional Services', icon: FileText },
  { value: 'other', label: 'Other Expenses', icon: Receipt },
];

// Main Tax Tracker Component
export function TaxTracker() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    category: 'software',
    isDeductible: true,
  });

  // Fetch tax data
  const { data: taxSummary, isLoading: summaryLoading } = useQuery<TaxSummary>({
    queryKey: ['/api/tax/summary', selectedYear],
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ['/api/tax/expenses', selectedYear, selectedQuarter],
  });

  // Calculate category totals
  const categoryTotals = expenses?.reduce((acc, expense) => {
    if (!expense.isDeductible) return acc;
    
    const category = acc[expense.category] || {
      totalAmount: 0,
      itemCount: 0,
    };
    
    category.totalAmount += expense.amount;
    category.itemCount += 1;
    
    acc[expense.category] = category;
    return acc;
  }, {} as Record<string, { totalAmount: number; itemCount: number }>);

  // Build tax categories for display
  const taxCategories: TaxCategory[] = expenseCategories.map((cat) => {
    const totals = categoryTotals?.[cat.value] || { totalAmount: 0, itemCount: 0 };
    const colors = {
      software: 'from-purple-500 to-pink-500',
      equipment: 'from-blue-500 to-cyan-500',
      tech: 'from-green-500 to-emerald-500',
      travel: 'from-orange-500 to-red-500',
      office: 'from-indigo-500 to-purple-500',
      marketing: 'from-pink-500 to-rose-500',
      services: 'from-teal-500 to-green-500',
      other: 'from-gray-500 to-slate-500',
    };

    return {
      id: cat.value,
      name: cat.label,
      icon: cat.icon,
      description: `${totals.itemCount} expenses tracked`,
      totalAmount: totals.totalAmount,
      itemCount: totals.itemCount,
      color: colors[cat.value as keyof typeof colors] || colors.other,
    };
  });

  // Handlers
  const handleAddExpense = () => {
    // TODO: Implement expense creation
    // Add expense functionality
    setShowAddExpense(false);
    setNewExpense({ category: 'software', isDeductible: true });
  };

  const handleExportReport = () => {
    // TODO: Implement report export
    // Export tax report functionality
  };

  const quarterName = `Q${selectedQuarter} ${selectedYear}`;
  const daysInQuarter = 90;
  const daysRemaining = Math.max(0, daysInQuarter - (new Date().getDate() % daysInQuarter));
  const quarterProgress = ((daysInQuarter - daysRemaining) / daysInQuarter) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Tax & Expense Tracker</h2>
          <p className="text-muted-foreground">
            Track business expenses for tax deductions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleExportReport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Tax Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Expenses</span>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">${taxSummary?.totalExpenses ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Year to date</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Deductible</span>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">${taxSummary?.deductibleExpenses ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Qualified expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Tax Savings</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-green-600">${taxSummary?.ytdSavings ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Estimated savings</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Tax Rate</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{taxSummary?.taxRate ?? 25}%</p>
            <p className="text-xs text-muted-foreground mt-1">Effective rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Quarterly Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Quarterly Tax Payment</CardTitle>
          <CardDescription>Track your estimated tax payment for {quarterName}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">${taxSummary?.quarterlyEstimate ?? 0}</p>
                <p className="text-sm text-muted-foreground">Estimated payment due</p>
              </div>
              <Badge variant={daysRemaining <= 14 ? 'destructive' : 'outline'}>
                {daysRemaining} days remaining
              </Badge>
            </div>
            <Progress value={quarterProgress} className="h-2" />
            {daysRemaining <= 14 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Payment Due Soon</AlertTitle>
                <AlertDescription>
                  Your quarterly tax payment is due in {daysRemaining} days. 
                  Make sure to set aside ${taxSummary?.quarterlyEstimate ?? 0}.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expense Categories */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Expense Categories</CardTitle>
              <CardDescription>Breakdown of your deductible business expenses</CardDescription>
            </div>
            <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Business Expense</DialogTitle>
                  <DialogDescription>
                    Track a new business expense for tax deductions
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select 
                      value={newExpense.category} 
                      onValueChange={(v) => setNewExpense({ ...newExpense, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div className="flex items-center gap-2">
                              <cat.icon className="h-4 w-4" />
                              {cat.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      placeholder="e.g., ThottoPilot Pro subscription"
                      value={newExpense.description || ''}
                      onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount ($)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={newExpense.amount || ''}
                      onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Additional details..."
                      value={newExpense.notes || ''}
                      onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="deductible"
                      checked={newExpense.isDeductible}
                      onChange={(e) => setNewExpense({ ...newExpense, isDeductible: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="deductible">Tax deductible</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAddExpense(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddExpense}>
                      Add Expense
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {taxCategories.map((category) => {
              const Icon = category.icon;
              return (
                <div
                  key={category.id}
                  className="group cursor-pointer rounded-lg border p-4 transition-all hover:shadow-md"
                >
                  <div className={cn('mb-3 inline-flex rounded-lg bg-gradient-to-br p-2', category.color)}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h4 className="font-semibold text-sm mb-1">{category.name}</h4>
                  <p className="text-2xl font-bold">${category.totalAmount}</p>
                  <p className="text-xs text-muted-foreground">{category.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Expenses</CardTitle>
          <CardDescription>Your latest business expense entries</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All Expenses</TabsTrigger>
              <TabsTrigger value="deductible">Deductible Only</TabsTrigger>
              <TabsTrigger value="receipts">Need Receipts</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4">
              {expensesLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading expenses...</p>
                </div>
              ) : expenses && expenses.length > 0 ? (
                <div className="space-y-2">
                  {expenses.map((expense) => {
                    const category = expenseCategories.find(c => c.value === expense.category);
                    const Icon = category?.icon || Receipt;
                    return (
                      <div key={expense.id} className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex items-center gap-4">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{expense.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {category?.label} • {format(expense.date, 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {expense.isDeductible && (
                            <Badge variant="outline" className="text-green-600">
                              Deductible
                            </Badge>
                          )}
                          <span className="font-semibold">${expense.amount}</span>
                          <Button variant="ghost" size="sm">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No expenses tracked yet</p>
                  <Button 
                    className="mt-4" 
                    onClick={() => setShowAddExpense(true)}
                  >
                    Add Your First Expense
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Deduction Tips */}
      <Alert>
        <TrendingUp className="h-4 w-4" />
        <AlertTitle>Tax Deduction Tips</AlertTitle>
        <AlertDescription>
          Common deductible expenses for content creators: Software subscriptions (editing tools, scheduling apps),
          Equipment (cameras, lighting, computers), Home office expenses, Internet & phone bills,
          Marketing costs, and Professional services (accountants, lawyers).
        </AlertDescription>
      </Alert>
    </div>
  );
}
