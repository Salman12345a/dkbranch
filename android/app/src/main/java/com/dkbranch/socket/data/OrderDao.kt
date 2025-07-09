package com.dkbranch.socket.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface OrderDao {
    @Query("SELECT * FROM orders WHERE orderId = :orderId")
    fun getOrderById(orderId: String): OrderEntity?

    @Query("SELECT * FROM orders WHERE branchId = :branchId ORDER BY createdAt DESC")
    fun getOrdersForBranch(branchId: String): Flow<List<OrderEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertOrder(order: OrderEntity)
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insert(order: OrderEntity)

    @Update
    fun updateOrder(order: OrderEntity)

    @Query("DELETE FROM orders WHERE createdAt < :timestamp")
    fun deleteOldOrders(timestamp: Long): Int

    @Query("SELECT COUNT(*) FROM orders WHERE status = 'Pending' OR status = 'Confirmed'")
    fun getPendingOrderCount(): Int
}