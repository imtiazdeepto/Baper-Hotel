// ============================================================
// RESTAURANT FOOD ORDERING AND MANAGEMENT SYSTEM
// Client Configuration
// ============================================================
// You can set your Supabase credentials here for static hosting
// OR set them in a .env file for Vite development (VITE_SUPABASE_URL).
//
// NEVER expose your service_role secret key here!
// ONLY use your public 'anon' key.
// ============================================================

export const APP_CONFIG = {
  // Live Supabase project credentials:
  SUPABASE_URL: "https://ohxycazhttmingxupngr.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oeHljYXpodHRtaW5neHVwbmdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0NjQ0ODYsImV4cCI6MjExMDA0MDQ4Nn0.oYhVJTlQaECdkQw6Hw62wWF8tdzlDDOoOOqub9nWW1M",
  
  // Restaurant brand details
  RESTAURANT_NAME: "Baper Hotel",
  RESTAURANT_TAGLINE: "Authentic, Delicious & Fresh",
  CURRENCY_SYMBOL: "৳",
  CURRENCY_CODE: "BDT",
  DEFAULT_DELIVERY_FEE: 0.00, // Free delivery for assessment promotion
  
  // Storage bucket name for food image uploads
  STORAGE_BUCKET: "food-images"
};
