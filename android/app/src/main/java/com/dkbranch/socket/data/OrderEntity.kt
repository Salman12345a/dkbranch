package com.dkbranch.socket.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverters

@Entity(tableName = "orders")
data class OrderEntity(
    @PrimaryKey
    val orderId: String,
    val branchId: String,
    val orderData: String,
    val status: String,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
) 