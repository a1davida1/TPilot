import React, { useState } from 'react';
import { Calendar, Plus, TrendingUp, FileText, Calculator, Info, DollarSign, Receipt, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';

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

const TaxTracker: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState(expenseCategories[0]);
  const [activeTab, setActiveTab] = useState('overview');

  const totalExpenses = 15420; // This would come from API
  const totalDeductions = 15420;
  const estimatedSavings = 4626; // Assuming 30% tax rate

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
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
        </motion.div>

        {/* Quick Stats */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Expenses</p>
                  <p className="text-2xl font-bold text-gray-900">${totalExpenses.toLocaleString()}</p>
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
                  <p className="text-2xl font-bold text-gray-900">${totalDeductions.toLocaleString()}</p>
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
                  <p className="text-2xl font-bold text-gray-900">${estimatedSavings.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

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
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              {/* Quick Actions */}
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Plus className="h-5 w-5 text-purple-600" />
                    <span>Quick Actions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg">
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Expense
                  </Button>
                  <Button variant="outline" className="w-full border-purple-200 hover:bg-purple-50">
                    <Receipt className="mr-2 h-4 w-4" />
                    Upload Receipt
                  </Button>
                  <Button variant="outline" className="w-full border-purple-200 hover:bg-purple-50">
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
                  {[
                    { description: 'Professional makeup session', amount: 250, category: 'Beauty & Wellness', date: '2 days ago' },
                    { description: 'Ring light & camera', amount: 450, category: 'Technology & Equipment', date: '1 week ago' },
                    { description: 'Designer outfit collection', amount: 680, category: 'Wardrobe & Fashion', date: '1 week ago' }
                  ].map((expense, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{expense.description}</p>
                        <p className="text-sm text-gray-500">{expense.category} • {expense.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">${expense.amount}</p>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          100% Deductible
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {expenseCategories.map((category, index) => {
                const IconComponent = category.icon;
                return (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
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
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Selected Category Details */}
            <AnimatePresence>
              {selectedCategory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
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
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  <span>Expense Calendar</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Calendar View Coming Soon</h3>
                  <p className="text-gray-600">Interactive calendar for expense tracking and planning</p>
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
      </div>
    </div>
  );
};

export default TaxTracker;