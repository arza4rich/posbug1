import { collection, addDoc, updateDoc, doc, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Product, POSTransaction } from '@/types';

// Process a POS transaction and update inventory
export const processPOSTransaction = async (transaction: Omit<POSTransaction, 'id'>) => {
  try {
    // Use a transaction to ensure atomicity
    await runTransaction(db, async (firestoreTransaction) => {
      // Update product stock for each item
      for (const item of transaction.items) {
        const productRef = doc(db, 'products', item.product.id);
        const productDoc = await firestoreTransaction.get(productRef);
        
        if (!productDoc.exists()) {
          throw new Error(`Product ${item.product.name} not found`);
        }
        
        const productData = productDoc.data() as Product;
        
        // Check if there's enough stock
        if (productData.stock < item.quantity) {
          throw new Error(`Not enough stock for ${item.product.name}. Available: ${productData.stock}, Requested: ${item.quantity}`);
        }
        
        // Update stock
        firestoreTransaction.update(productRef, {
          stock: productData.stock - item.quantity,
          updated_at: new Date().toISOString()
        });
      }
    });
    
    // Create transaction record
    const transactionRef = await addDoc(collection(db, 'pos_transactions'), {
      ...transaction,
      createdAt: new Date().toISOString()
    });
    
    // Create financial transaction record
    await addDoc(collection(db, 'financial_transactions'), {
      transactionId: transactionRef.id,
      date: new Date().toISOString(),
      category: 'sales',
      type: 'income',
      amount: transaction.totalAmount,
      description: `POS Sale by ${transaction.cashierName}`,
      paymentMethod: transaction.paymentMethod,
      createdAt: new Date().toISOString()
    });
    
    return transactionRef.id;
  } catch (error) {
    console.error('Error processing POS transaction:', error);
    throw error;
  }
};

// Get financial summary for dashboard
export const getFinancialSummary = async (startDate: Date, endDate: Date) => {
  try {
    // Implement financial summary logic
    // This would fetch transactions between dates and calculate totals
    return {
      totalSales: 0,
      totalExpenses: 0,
      netProfit: 0,
      transactionCount: 0
    };
  } catch (error) {
    console.error('Error getting financial summary:', error);
    throw error;
  }
};