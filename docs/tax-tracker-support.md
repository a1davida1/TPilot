# Tax Tracker Customer Support Guide

This document provides troubleshooting guidance and solutions for common Tax Tracker issues to help customer support teams resolve user problems efficiently.

## Overview

The Tax Tracker is a comprehensive expense management system designed for content creators to track business expenses and maximize tax deductions. It features automated categorization, receipt upload, real-time calculations, and IRS-compliant documentation.

## Common Issues and Solutions

### 1. Receipt Upload Failures

**Symptoms:**
- "No file uploaded" error message
- Receipt upload button not responding
- Files appear to upload but don't save to expense

**Troubleshooting Steps:**

1. **File Format Check**
   - Supported formats: JPEG, PNG, PDF
   - Maximum file size: Check S3 configuration or local storage limits
   - Verify file is not corrupted

2. **Browser Issues**
   - Clear browser cache and cookies
   - Try different browser (Chrome, Firefox, Safari)
   - Disable browser extensions temporarily
   - Ensure JavaScript is enabled

3. **Authentication Issues**
   - Verify user is logged in
   - Check JWT token validity
   - Have user log out and back in

4. **Backend Configuration**
   - If using S3: Verify AWS credentials and bucket permissions
   - If local storage: Check server disk space and upload directory permissions
   - Review server logs for specific error messages

**API Endpoint:** `POST /api/expenses/:id/receipt`

**Common Error Codes:**
- `400`: No file uploaded or invalid expense ID
- `401`: Authentication required
- `500`: Server error (check logs for specifics)

### 2. Permission Errors for Free Tier Users

**Symptoms:**
- "Authentication required" messages
- Unable to access tax tracker features
- Blank expense list despite being logged in

**Troubleshooting Steps:**

1. **Authentication Verification**
   ```bash
   # Check user session/token
   GET /api/auth/user
   ```
   - Should return user object with tier information
   - If 401 error, user needs to re-authenticate

2. **Tier Verification**
   - Confirm user tier in database
   - Tax tracker is available to all authenticated users (no tier restrictions)
   - If tier is 'guest', user needs to complete registration

3. **Route Access**
   - Verify user is accessing `/tax-tracker` route
   - Ensure route is properly configured in App.tsx
   - Check for client-side routing issues

4. **Session Issues**
   - Clear browser storage
   - Have user log out completely and sign back in
   - Check session expiration settings

### 3. Missing Categories or Totals Not Updating

**Symptoms:**
- Expense categories not loading
- Total amounts showing as $0.00 despite expenses
- Category dropdown empty or missing options

**Troubleshooting Steps:**

1. **Database Seeding**
   ```bash
   # Verify expense categories exist
   SELECT * FROM expense_categories WHERE is_active = true;
   ```
   - Should return 6 default categories
   - If empty, run seeding script: `npm run db:seed`

2. **API Endpoint Testing**
   ```bash
   # Test category endpoint
   GET /api/expense-categories
   
   # Test totals endpoint  
   GET /api/expenses/totals?taxYear=2024
   ```

3. **Calculation Logic**
   - Verify expenses have valid amounts (stored in cents)
   - Check deduction percentages are properly applied
   - Confirm category relationships are intact

4. **Cache Issues**
   - Clear React Query cache (logout/login)
   - Check for stale data in browser
   - Verify API responses are not cached inappropriately

### 4. Calendar View Not Loading

**Symptoms:**
- Calendar shows no expenses despite existing records
- Calendar component not rendering
- Dates showing incorrect or no data

**Troubleshooting Steps:**

1. **Date Range API**
   ```bash
   # Test date range endpoint
   GET /api/expenses/range?startDate=2024-01-01&endDate=2024-01-31
   ```

2. **Date Format Issues**
   - Verify expense dates are in correct ISO format
   - Check timezone handling
   - Ensure date parsing is working correctly

3. **Component State**
   - Check React component state for calendar date
   - Verify tab switching functionality
   - Look for JavaScript errors in browser console

### 5. Expense Creation/Editing Problems

**Symptoms:**
- Expenses not saving
- Form validation errors
- Amounts not calculating correctly

**Troubleshooting Steps:**

1. **Form Validation**
   - Description: Required, non-empty string
   - Amount: Required, positive number
   - Category: Required, valid category ID
   - Date: Required, valid date format

2. **Amount Conversion**
   - Frontend sends amounts as floats (e.g., 150.00)
   - Backend converts to cents (e.g., 15000)
   - Verify conversion math is correct

3. **Category Assignment**
   - Check category IDs match database records
   - Ensure selected category is active
   - Verify category relationships

## Diagnostic Commands

### Database Queries
```sql
-- Check user expenses
SELECT e.*, ec.name as category_name 
FROM expenses e 
LEFT JOIN expense_categories ec ON e.category_id = ec.id 
WHERE e.user_id = [USER_ID];

-- Check expense totals
SELECT 
  COUNT(*) as total_expenses,
  SUM(amount) as total_amount,
  SUM(amount * deduction_percentage / 100) as deductible_amount
FROM expenses 
WHERE user_id = [USER_ID] AND tax_year = [YEAR];

-- Check active categories
SELECT * FROM expense_categories WHERE is_active = true ORDER BY sort_order;
```

### API Testing
```bash
# Test authentication
curl -H "Authorization: Bearer [TOKEN]" http://localhost:5000/api/auth/user

# Test expense creation
curl -X POST http://localhost:5000/api/expenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TOKEN]" \
  -d '{"description":"Test expense","amount":50,"categoryId":1,"expenseDate":"2024-01-15"}'

# Test totals calculation
curl -H "Authorization: Bearer [TOKEN]" \
  "http://localhost:5000/api/expenses/totals?taxYear=2024"
```

## Escalation Guidelines

### When to Escalate to Development Team

1. **Data Corruption Issues**
   - Negative amounts or impossible values
   - Missing critical data after successful operations
   - Database constraint violations

2. **Performance Problems**
   - API endpoints taking >5 seconds to respond
   - Memory leaks or server crashes
   - Database query timeouts

3. **Security Concerns**
   - Users seeing other users' expenses
   - Authentication bypasses
   - Data exposure in logs

4. **Integration Failures**
   - S3 upload consistently failing
   - Payment tier restrictions not working
   - Email notifications not sending

### Information to Collect Before Escalation

1. **User Information**
   - User ID and email
   - Account tier (free, starter, pro)
   - Registration date

2. **Error Details**
   - Exact error messages
   - Browser and version
   - Steps to reproduce
   - Server logs (if accessible)

3. **Environment Context**
   - Time of occurrence
   - Geographic location
   - Device type (mobile/desktop)

## Prevention and Monitoring

### Proactive Monitoring

1. **API Health Checks**
   - Monitor expense creation success rates
   - Track receipt upload failure rates
   - Alert on calculation discrepancies

2. **Database Monitoring**
   - Watch for orphaned expenses (no category)
   - Monitor expense table growth
   - Check for data integrity issues

3. **User Experience Metrics**
   - Track tax tracker page load times
   - Monitor form abandonment rates
   - Measure feature adoption rates

### Maintenance Tasks

1. **Regular Data Cleanup**
   - Remove orphaned receipt files
   - Archive old tax year data
   - Clean up incomplete expense records

2. **Category Management**
   - Review and update deduction percentages
   - Add new categories based on user feedback
   - Maintain tax law compliance information

3. **Performance Optimization**
   - Optimize expensive database queries
   - Implement caching for category data
   - Monitor and improve API response times

## Support Script Templates

### Receipt Upload Issue
```
Hi [User Name],

I understand you're having trouble uploading receipts. Let's troubleshoot this together:

1. Please verify your file is in JPEG, PNG, or PDF format
2. Ensure the file size is under [SIZE_LIMIT]
3. Try refreshing the page and logging in again
4. If using Safari, please try Chrome or Firefox

If these steps don't resolve the issue, please let me know:
- What browser are you using?
- What file format are you trying to upload?
- Any error messages you're seeing?

I'm here to help get this resolved quickly.

Best regards,
[Support Agent]
```

### Category Missing Issue
```
Hi [User Name],

I see you're not seeing expense categories in your tax tracker. This is usually a quick fix:

1. Please log out completely and log back in
2. Clear your browser cache
3. Try accessing the tax tracker again

If categories still don't appear, there may be a backend issue. I've escalated this to our technical team and will update you within 2 hours with a resolution.

Your expense data is safe and will be fully accessible once we resolve this display issue.

Best regards,
[Support Agent]
```

This support guide should help resolve 90% of common tax tracker issues. For complex technical problems, involve the development team early to prevent extended user downtime.