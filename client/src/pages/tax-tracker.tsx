import React, { useState } from 'react';
import { Calendar, Plus, TrendingUp, FileText, Calculator, Info, DollarSign, Receipt, Sparkles, Upload, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// Temporarily disabled framer-motion to fix runtime errors
// import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';

// Apple-inspired color palette
const colors = {
  blue: '#007AFF',
  purple: '#AF52DE',
  pink: '#FF2D92', 
  orange: '#FF9500',
  green: '#34C759',
  red: '#FF3B30',
  yellow: '#FFCC00',
  indigo: '#5856D6',
  teal: '#5AC8FA',
  mint: '#00C7BE'
};

const expenseCategories = [
  {
    id: 1,
    name: 'Beauty & Wellness',
    icon: Sparkles,
    color: colors.pink,
    deductionPercentage: 100,
    description: 'Professional beauty treatments, skincare, wellness services',
    legalExplanation: 'Beauty and wellness expenses are 100% deductible for content creators as they directly relate to maintaining your professional appearance and brand image.',
    examples: ['Professional makeup', 'Skincare treatments', 'Hair styling', 'Nail services', 'Spa treatments', 'Fitness training']
  },
  {
    id: 2,
    name: 'Wardrobe & Fashion',
    icon: Receipt,
    color: colors.purple,
    deductionPercentage: 100,
    description: 'Clothing, accessories, and fashion items for content',
    legalExplanation: 'Clothing and accessories purchased specifically for content creation are fully deductible business expenses.',
    examples: ['Lingerie & outfits', 'Shoes & accessories', 'Costumes', 'Jewelry', 'Designer pieces', 'Seasonal wardrobe']
  },
  {
    id: 3,
    name: 'Technology & Equipment',
    icon: Calculator,
    color: colors.blue,
    deductionPercentage: 100,
    description: 'Cameras, lighting, computers, and tech gear',
    legalExplanation: 'All technology and equipment used for content creation and business operations are fully deductible.',
    examples: ['Cameras & lenses', 'Lighting equipment', 'Computers & tablets', 'Editing software', 'Storage devices', 'Audio equipment']
  },
  {
    id: 4,
    name: 'Travel & Entertainment',
    icon: TrendingUp,
    color: colors.teal,
    deductionPercentage: 100,
    description: 'Business travel, events, and entertainment expenses',
    legalExplanation: 'Travel for business purposes, including content creation trips and industry events, is fully deductible.',
    examples: ['Business travel', 'Hotel stays', 'Convention tickets', 'Networking events', 'Content creation trips', 'Transportation']
  },
  {
    id: 5,
    name: 'Home Office & Utilities',
    icon: FileText,
    color: colors.green,
    deductionPercentage: 100,
    description: 'Home office expenses, internet, phone, utilities',
    legalExplanation: 'Home office expenses including utilities, internet, and phone bills are deductible based on business use percentage.',
    examples: ['Internet & phone', 'Utilities (portion)', 'Home office furniture', 'Decorations & props', 'Office supplies', 'Storage solutions']
  },
  {
    id: 6,
    name: 'Marketing & Promotion',
    icon: DollarSign,
    color: colors.orange,
    deductionPercentage: 100,
    description: 'Advertising, promotions, and marketing expenses',
    legalExplanation: 'All marketing and promotional expenses to grow your business are fully deductible.',
    examples: ['Social media ads', 'Website costs', 'Professional photography', 'Graphic design', 'Business cards', 'Promotional materials']
  }
];

interface TaxTrackerProps {
  userTier?: 'guest' | 'free' | 'pro' | 'premium';
}

const TaxTracker: React.FC<TaxTrackerProps> = ({ userTier = 'free' }) => {
  const [selectedCategory, setSelectedCategory] = useState(expenseCategories[0]);
  const [activeTab, setActiveTab] = useState('overview');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptExpenseId, setReceiptExpenseId] = useState('');
  
  const queryClient = useQueryClient();

  // Fetch expense totals
  const { data: expenseTotals = { total: 0, deductible: 0, byCategory: {} } } = useQuery({
    queryKey: ['/api/expenses/totals'],
    queryFn: async () => {
      const res = await fetch('/api/expenses/totals');
      if (!res.ok) throw new Error('Failed to fetch expense totals');
      return res.json();
    }
  });

  // Fetch recent expenses
  const { data: recentExpenses = [] } = useQuery({
    queryKey: ['/api/expenses'],
    queryFn: async () => {
      const res = await fetch('/api/expenses');
      if (!res.ok) throw new Error('Failed to fetch expenses');
      return res.json();
    }
  });

  // Fetch calendar expenses
  const { data: calendarExpenses = [] } = useQuery({
    queryKey: ['/api/expenses/range', format(startOfMonth(calendarDate), 'yyyy-MM-dd'), format(endOfMonth(calendarDate), 'yyyy-MM-dd')],
    enabled: activeTab === 'calendar',
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: format(startOfMonth(calendarDate), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(calendarDate), 'yyyy-MM-dd')
      });
      const res = await fetch(`/api/expenses/range?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch expenses');
      return res.json();
    }
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (expenseData: any) => {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData)
      });
      if (!response.ok) throw new Error('Failed to create expense');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/totals'] });
      setShowExpenseModal(false);
      setExpenseForm({ description: '', amount: '', category: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    }
  });

  const uploadReceiptMutation = useMutation({
    mutationFn: async ({ expenseId, file }: { expenseId: string; file: File }) => {
      const formData = new FormData();
      formData.append('receipt', file);
      const res = await fetch(`/api/expenses/${expenseId}/receipt`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to upload receipt');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      setShowReceiptModal(false);
      setReceiptFile(null);
      setReceiptExpenseId('');
    }
  });

  const handleCreateExpense = () => {
    if (!expenseForm.description || !expenseForm.amount || !expenseForm.category) return;

    createExpenseMutation.mutate({
      description: expenseForm.description,
      amount: parseFloat(expenseForm.amount),
      categoryId: parseInt(expenseForm.category),
      expenseDate: expenseForm.date,
      notes: expenseForm.notes
    });
  };

  const handleReceiptUpload = () => {
    if (!receiptFile || !receiptExpenseId) return;
    uploadReceiptMutation.mutate({ expenseId: receiptExpenseId, file: receiptFile });
  };

  const getDaysWithExpenses = () => {
    const daysInMonth = eachDayOfInterval({
      start: startOfMonth(calendarDate),
      end: endOfMonth(calendarDate)
    });
    
    return daysInMonth.map(day => {
      const dayExpenses = calendarExpenses.filter((expense: any) => 
        isSameDay(parseISO(expense.date), day)
      );
      const totalAmount = dayExpenses.reduce((sum: number, expense: any) => sum + expense.amount, 0);
      
      return {
        date: day,
        expenses: dayExpenses,
        totalAmount
      };
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-3">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-lg">
              <Calculator className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Tax Tracker
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Almost everything in your life as a content creator is tax deductible. 
            Track your expenses and maximize your savings with confidence.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Expenses</p>
                  <p className="text-2xl font-bold text-gray-900">${(expenseTotals?.totalExpenses || 0).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Tax Deductions</p>
                  <p className="text-2xl font-bold text-gray-900">${(expenseTotals?.totalDeductions || 0).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Estimated Savings</p>
                  <p className="text-2xl font-bold text-gray-900">${(expenseTotals?.estimatedSavings || 0).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/80 backdrop-blur-sm border-0 shadow-lg p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="categories" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white">
              Categories
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white">
              Calendar
            </TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white">
              Tax Tips
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Quick Actions */}
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Plus className="h-5 w-5 text-purple-600" />
                    <span>Quick Actions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={() => setShowExpenseModal(true)}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
                    data-testid="button-add-expense"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Expense
                  </Button>
                  <Button 
                    onClick={() => setShowReceiptModal(true)}
                    variant="outline" 
                    className="w-full border-purple-200 hover:bg-purple-50"
                    data-testid="button-upload-receipt"
                  >
                    <Receipt className="mr-2 h-4 w-4" />
                    Upload Receipt
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('calendar')}
                    variant="outline" 
                    className="w-full border-purple-200 hover:bg-purple-50"
                    data-testid="button-view-calendar"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    View Calendar
                  </Button>
                </CardContent>
              </Card>

              {/* Recent Expenses */}
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                <CardHeader>
                  <CardTitle>Recent Expenses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentExpenses.length === 0 ? (
                    <div className="text-center py-8">
                      <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500 mb-4">No expenses tracked yet</p>
                      <Button 
                        onClick={() => setShowExpenseModal(true)}
                        size="sm"
                        className="bg-gradient-to-r from-purple-500 to-pink-500"
                      >
                        Add Your First Expense
                      </Button>
                    </div>
                  ) : (
                    recentExpenses.slice(0, 3).map((expense: any, index: number) => (
                      <div 
                        key={expense.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{expense.description}</p>
                          <p className="text-sm text-gray-500">{expense.category} • {format(parseISO(expense.date), 'MMM d, yyyy')}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">${expense.amount}</p>
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            100% Deductible
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {expenseCategories.map((category, index) => {
                const IconComponent = category.icon;
                return (
                  <div key={category.id}>
                    <Card 
                      className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
                      onClick={() => setSelectedCategory(category)}
                    >
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div 
                              className="p-3 rounded-xl text-white shadow-lg"
                              style={{ backgroundColor: category.color }}
                            >
                              <IconComponent className="h-6 w-6" />
                            </div>
                            <Badge className="bg-green-100 text-green-700">
                              {category.deductionPercentage}% Deductible
                            </Badge>
                          </div>
                          
                          <div>
                            <h3 className="font-bold text-lg text-gray-900 group-hover:text-purple-600 transition-colors">
                              {category.name}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {category.description}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-2">Examples:</p>
                            <div className="flex flex-wrap gap-1">
                              {category.examples.slice(0, 3).map((example, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {example}
                                </Badge>
                              ))}
                              {category.examples.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{category.examples.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>

            {/* Selected Category Details */}
            {selectedCategory && (
              <div>
                  <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-3">
                        <div 
                          className="p-2 rounded-lg text-white"
                          style={{ backgroundColor: selectedCategory.color }}
                        >
                          <selectedCategory.icon className="h-5 w-5" />
                        </div>
                        <span>{selectedCategory.name} - Legal Details</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <div className="flex items-start space-x-3">
                          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-blue-900 mb-2">Tax Deduction Explanation</h4>
                            <p className="text-blue-800 text-sm leading-relaxed">
                              {selectedCategory.legalExplanation}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">What's Included:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {selectedCategory.examples.map((example, idx) => (
                            <div key={idx} className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="text-sm text-gray-700">{example}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    <span>Expense Calendar</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm font-medium min-w-[120px] text-center">
                      {format(calendarDate, 'MMMM yyyy')}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {getDaysWithExpenses().map((dayData, index) => (
                    <div 
                      key={index}
                      className={`
                        min-h-[80px] p-2 border border-gray-200 rounded-lg cursor-pointer
                        hover:bg-gray-50 transition-colors
                        ${isSameDay(dayData.date, new Date()) ? 'bg-purple-50 border-purple-200' : 'bg-white'}
                      `}
                    >
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        {format(dayData.date, 'd')}
                      </div>
                      {dayData.totalAmount > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-green-600">
                            ${dayData.totalAmount.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {dayData.expenses.length} expense{dayData.expenses.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-green-700">✅ What's Deductible</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    'Beauty treatments & skincare',
                    'Wardrobe & fashion pieces',
                    'Technology & equipment',
                    'Home office expenses',
                    'Travel for content creation',
                    'Marketing & advertising'
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-purple-700">💡 Pro Tips</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    'Keep all receipts & documentation',
                    'Track business purpose for each expense',
                    'Separate business & personal expenses',
                    'Consider quarterly tax payments',
                    'Consult with a tax professional',
                    'Use this app to stay organized!'
                  ].map((tip, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      <span className="text-sm text-gray-700">{tip}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Expense Modal */}
        <Dialog open={showExpenseModal} onOpenChange={setShowExpenseModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Plus className="h-5 w-5 text-purple-600" />
                <span>Add New Expense</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                  placeholder="e.g., Professional makeup session"
                  data-testid="input-expense-description"
                />
              </div>
              
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                  placeholder="0.00"
                  data-testid="input-expense-amount"
                />
              </div>
              
              <div>
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={expenseForm.category} 
                  onValueChange={(value) => setExpenseForm({...expenseForm, category: value})}
                >
                  <SelectTrigger data-testid="select-expense-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(category => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                  data-testid="input-expense-date"
                />
              </div>
              
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({...expenseForm, notes: e.target.value})}
                  placeholder="Additional details about this expense"
                  data-testid="textarea-expense-notes"
                />
              </div>
              
              <div className="flex space-x-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1"
                  data-testid="button-cancel-expense"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateExpense}
                  disabled={!expenseForm.description || !expenseForm.amount || !expenseForm.category || createExpenseMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
                  data-testid="button-create-expense"
                >
                  {createExpenseMutation.isPending ? 'Adding...' : 'Add Expense'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Upload Receipt Modal */}
        <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5 text-purple-600" />
                <span>Upload Receipt</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={receiptExpenseId} onValueChange={setReceiptExpenseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select expense" />
                </SelectTrigger>
                <SelectContent>
                  {recentExpenses.map((exp: any) => (
                    <SelectItem key={exp.id} value={String(exp.id)}>
                      {exp.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                {receiptFile ? (
                  <div className="space-y-2">
                    <Receipt className="h-12 w-12 text-green-600 mx-auto" />
                    <p className="text-sm font-medium text-gray-900">{receiptFile.name}</p>
                    <p className="text-xs text-gray-500">{(receiptFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setReceiptFile(null)}
                      data-testid="button-remove-receipt"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                    <p className="text-sm text-gray-600">Drag and drop your receipt here</p>
                    <p className="text-xs text-gray-500">or click to browse</p>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="receipt-upload"
                      data-testid="input-receipt-file"
                    />
                    <Label 
                      htmlFor="receipt-upload"
                      className="cursor-pointer inline-block px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      Choose File
                    </Label>
                  </div>
                )}
              </div>
              
              <div className="flex space-x-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowReceiptModal(false)}
                  className="flex-1"
                  data-testid="button-cancel-receipt"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleReceiptUpload}
                  disabled={!receiptFile}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
                  data-testid="button-upload-receipt"
                >
                  Upload Receipt
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default TaxTracker;