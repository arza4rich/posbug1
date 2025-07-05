import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Order } from '@/types';

interface FinancialSummary {
  revenue: number;
  expenses: number;
  profit: number;
  orderCount: number;
  shippingCost: number;
  paymentMethods: Record<string, number>;
}

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  orderCount: number;
}

export const useFinancialReports = (yearMonth: string) => {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchFinancialData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Parse year and month
        const [year, month] = yearMonth.split('-').map(Number);
        
        // Create date range for the selected month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of month
        
        // Fetch orders for the selected month
        const ordersRef = collection(db, 'orders');
        const q = query(
          ordersRef,
          where('created_at', '>=', startDate.toISOString()),
          where('created_at', '<=', endDate.toISOString())
        );
        
        const querySnapshot = await getDocs(q);
        const orders = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Order));
        
        // Calculate financial summary
        const revenue = orders.reduce((sum, order) => sum + order.total_price, 0);
        const shippingCost = orders.reduce((sum, order) => sum + (order.shipping_fee || 0), 0);
        const expenses = shippingCost; // For now, only shipping costs are considered as expenses
        const profit = revenue - expenses;
        
        // Calculate payment method distribution
        const paymentMethods: Record<string, number> = {};
        orders.forEach(order => {
          const method = order.customer_info?.payment_method || 'Unknown';
          paymentMethods[method] = (paymentMethods[method] || 0) + order.total_price;
        });
        
        // Set summary
        setSummary({
          revenue,
          expenses,
          profit,
          orderCount: orders.length,
          shippingCost,
          paymentMethods
        });
        
        // Fetch historical data for the last 6 months
        await fetchHistoricalData(year, month);
        
      } catch (err) {
        console.error('Error fetching financial data:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch financial data'));
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchFinancialData();
  }, [yearMonth]);
  
  // Fetch historical data for charts
  const fetchHistoricalData = async (year: number, month: number) => {
    try {
      const monthlyChartData: MonthlyData[] = [];
      
      // Get data for the last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(year, month - 1 - i, 1);
        const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const monthName = date.toLocaleDateString('ja-JP', { month: 'short' });
        
        // Fetch orders for this month
        const ordersRef = collection(db, 'orders');
        const q = query(
          ordersRef,
          where('created_at', '>=', new Date(date.getFullYear(), date.getMonth(), 1).toISOString()),
          where('created_at', '<=', endDate.toISOString())
        );
        
        const querySnapshot = await getDocs(q);
        const monthOrders = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Order));
        
        // Calculate revenue and expenses
        const revenue = monthOrders.reduce((sum, order) => sum + order.total_price, 0);
        const expenses = monthOrders.reduce((sum, order) => sum + (order.shipping_fee || 0), 0);
        
        monthlyChartData.push({
          month: monthName,
          revenue,
          expenses,
          profit: revenue - expenses,
          orderCount: monthOrders.length
        });
      }
      
      setMonthlyData(monthlyChartData);
      
    } catch (err) {
      console.error('Error fetching historical data:', err);
    }
  };
  
  return { summary, monthlyData, isLoading, error };
};