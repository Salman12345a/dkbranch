package com.dkbranch.socket.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class EncryptedSharedPreferencesManager(context: Context) {

    private val masterKeyAlias = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "dkbranch_secure_prefs",
        masterKeyAlias,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun putString(key: String, value: String?) {
        with(sharedPreferences.edit()) {
            putString(key, value)
            apply()
        }
    }

    fun getString(key: String, defaultValue: String?): String? {
        return sharedPreferences.getString(key, defaultValue)
    }

    fun clear() {
        with(sharedPreferences.edit()) {
            clear()
            apply()
        }
    }

    private val KEY_BRANCH_ID = "branch_id"
    private val KEY_TOKEN = "token"
    private val KEY_STORE_STATUS = "store_status" // Added for store status
    private val KEY_API_BASE_URL = "api_base_url" // Added for API base URL

    private fun getEncryptedPrefs(context: Context): SharedPreferences {
        return sharedPreferences
    }

    fun saveCredentials(context: Context, branchId: String, token: String) {
        val prefs = getEncryptedPrefs(context)
        with(prefs.edit()) {
            putString(KEY_BRANCH_ID, branchId)
            putString(KEY_TOKEN, token)
            apply()
        }
    }

    fun getBranchId(context: Context): String? {
        val prefs = getEncryptedPrefs(context)
        return prefs.getString(KEY_BRANCH_ID, null)
    }

    fun getToken(context: Context): String? {
        val prefs = getEncryptedPrefs(context)
        return prefs.getString(KEY_TOKEN, null)
    }

    fun clearCredentials(context: Context) {
        val prefs = getEncryptedPrefs(context)
        with(prefs.edit()) {
            remove(KEY_BRANCH_ID)
            remove(KEY_TOKEN)
            // Also clear store status when credentials are cleared (e.g., on logout)
            remove(KEY_STORE_STATUS) 
            apply()
        }
    }

    // Methods for store status
    fun saveStoreStatus(context: Context, isOpen: Boolean) {
        val prefs = getEncryptedPrefs(context)
        with(prefs.edit()) {
            putBoolean(KEY_STORE_STATUS, isOpen)
            apply()
        }
    }

    fun getStoreStatus(context: Context): Boolean {
        val prefs = getEncryptedPrefs(context)
        // Default to false (closed) if not set, so service doesn't start unintentionally
        return prefs.getBoolean(KEY_STORE_STATUS, false) 
    }
    
    // Methods for API base URL
    fun saveApiBaseUrl(context: Context, apiBaseUrl: String) {
        val prefs = getEncryptedPrefs(context)
        with(prefs.edit()) {
            putString(KEY_API_BASE_URL, apiBaseUrl)
            apply()
        }
    }
    
    fun getApiBaseUrl(context: Context): String? {
        val prefs = getEncryptedPrefs(context)
        // Default to the same value as in config.ts if not set
        return prefs.getString(KEY_API_BASE_URL, "https://dokirana.el.r.appspot.com/api")
    }
}