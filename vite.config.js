import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        register: resolve(__dirname, 'register.html'),
        cart: resolve(__dirname, 'cart.html'),
        checkout: resolve(__dirname, 'checkout.html'),
        orderConfirmation: resolve(__dirname, 'order-confirmation.html'),
        trackOrder: resolve(__dirname, 'track-order.html'),
        orderHistory: resolve(__dirname, 'order-history.html'),
        adminDashboard: resolve(__dirname, 'admin/dashboard.html'),
        adminFoods: resolve(__dirname, 'admin/foods.html'),
        adminFoodForm: resolve(__dirname, 'admin/food-form.html'),
        adminCategories: resolve(__dirname, 'admin/categories.html'),
        adminOrders: resolve(__dirname, 'admin/orders.html'),
        adminCoupons: resolve(__dirname, 'admin/coupons.html'),
        adminReports: resolve(__dirname, 'admin/reports.html'),
        staffOrders: resolve(__dirname, 'staff/orders.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
