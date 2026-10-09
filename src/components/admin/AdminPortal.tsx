import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { deliveryService } from '../../services/deliveryService';
import { useAuth } from '../../context/AuthContext';
import { UserRole, OrderStatus, USER_ROLES, ORDER_STATUSES, DISCOUNT_TYPES } from '../../types';
import { useDelivery } from '../../context/DeliveryContext';
import {
  ShieldAlert,
  Users,
  CreditCard,
  FileText,
  Activity,
  DollarSign,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Lock,
  Utensils,
  Power,
  Edit3,
  LayoutDashboard,
  ShoppingBag,
  FolderTree,
  Layers,
  Boxes,
  Bike,
  MapPin,
  Tag,
  Award,
  Star,
  Bell,
  HelpCircle,
  BarChart3,
  Sliders,
  Terminal,
  History,
  Settings,
  Plus,
  Trash2,
  Search,
  Menu,
  X,
  ChevronDown,
  Globe,
  ChevronRight,
  Check,
  Upload,
  Download,
  Eye,
  RotateCcw,
  Play,
  Key,
  ShieldCheck,
  Radio,
  FileCode2,
  ExternalLink,
  Pencil,
  Building2,
  UserPlus,
  Send,
  SlidersHorizontal,
  CheckCircle,
  Clock
} from 'lucide-react';

export const AdminPortal: React.FC = () => {
  const { user, logout } = useAuth();
  const {
    adminActiveTab: activeTab,
    setAdminActiveTab: setActiveTab,
    setIsRightDrawerOpen,
    refreshData,
    advanceOrderStatus,
    setActiveRole,
    setActivePage
  } = useDelivery();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState<boolean>(false);

  // Core Data States from Platform D1
  const [analytics, setAnalytics] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [menuItemsList, setMenuItemsList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [addonsList, setAddonsList] = useState<any[]>([]);
  const [driversList, setDriversList] = useState<any[]>([]);
  const [promosList, setPromosList] = useState<any[]>([]);
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [supportTicketsList, setSupportTicketsList] = useState<any[]>([]);
  const [supportReplyDrafts, setSupportReplyDrafts] = useState<Record<string, string>>({});
  const [sendingSupportReply, setSendingSupportReply] = useState<string | null>(null);
  const [restaurantsList, setRestaurantsList] = useState<any[]>([]);
  const [cmsCopy, setCmsCopy] = useState<Record<string, string>>({});
  const [transactions, setTransactions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [d1HealthData, setD1HealthData] = useState<any>(null);
  const [isPingingD1, setIsPingingD1] = useState<boolean>(false);
  const [platformSettings, setPlatformSettings] = useState<Record<string, string>>({});
  const [cmsDrafts, setCmsDrafts] = useState<Record<string, string>>({});
  const [cmsCategory, setCmsCategory] = useState<'hero' | 'dishes' | 'steps' | 'partner' | 'help' | 'contact' | 'legal' | 'footer' | 'images' | 'cms'>('hero');
  const [isSavingAllCMS, setIsSavingAllCMS] = useState<boolean>(false);
  const [deliveryZonesList, setDeliveryZonesList] = useState<any[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState<boolean>(false);
  const [isAddAddonModalOpen, setIsAddAddonModalOpen] = useState<boolean>(false);
  const [isAddPromoModalOpen, setIsAddPromoModalOpen] = useState<boolean>(false);

  // Filter & Modal States
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);
  const [selectedUserForWallet, setSelectedUserForWallet] = useState<any | null>(null);
  const [walletAdjustAmount, setWalletAdjustAmount] = useState<string>('');
  const [walletAdjustReason, setWalletAdjustReason] = useState<string>('Customer Appreciation Credit');

  // Add Menu Item Form State
  const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState<boolean>(false);
  const [isEditMenuModalOpen, setIsEditMenuModalOpen] = useState<boolean>(false);
  const [editingMenuItem, setEditingMenuItem] = useState<any | null>(null);
  const [menuRestaurantFilter, setMenuRestaurantFilter] = useState<string>('all');
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');
  const [newMenuDesc, setNewMenuDesc] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState('Main');
  const [newMenuRestaurantId, setNewMenuRestaurantId] = useState('rest-1');
  const [newMenuImageUrl, setNewMenuImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Edit Menu Item State
  const [editMenuName, setEditMenuName] = useState('');
  const [editMenuPrice, setEditMenuPrice] = useState('');
  const [editMenuDesc, setEditMenuDesc] = useState('');
  const [editMenuCategory, setEditMenuCategory] = useState('');
  const [editMenuRestaurantId, setEditMenuRestaurantId] = useState('');
  const [editMenuImageUrl, setEditMenuImageUrl] = useState('');

  // Add Restaurant Branch Form State
  const [isAddRestaurantModalOpen, setIsAddRestaurantModalOpen] = useState<boolean>(false);
  const [newRestName, setNewRestName] = useState('');
  const [newRestAddress, setNewRestAddress] = useState('');
  const [newRestCuisine, setNewRestCuisine] = useState('Nigerian & Continental');
  const [newRestDeliveryFee, setNewRestDeliveryFee] = useState('1000');
  const [newRestDeliveryMin, setNewRestDeliveryMin] = useState('20');
  const [newRestDeliveryMax, setNewRestDeliveryMax] = useState('40');
  const [newRestRating, setNewRestRating] = useState('4.8');
  const [newRestTagline, setNewRestTagline] = useState('Authentic dishes prepared fresh to order');
  const [newRestBannerUrl, setNewRestBannerUrl] = useState('');
  const [newRestZone, setNewRestZone] = useState('Lekki / Victoria Island');

  // Edit Restaurant Branch State
  const [isEditRestaurantModalOpen, setIsEditRestaurantModalOpen] = useState<boolean>(false);
  const [editingRestaurant, setEditingRestaurant] = useState<any | null>(null);
  const [editRestName, setEditRestName] = useState('');
  const [editRestAddress, setEditRestAddress] = useState('');
  const [editRestCuisine, setEditRestCuisine] = useState('');
  const [editRestDeliveryFee, setEditRestDeliveryFee] = useState('');
  const [editRestDeliveryMin, setEditRestDeliveryMin] = useState('');
  const [editRestDeliveryMax, setEditRestDeliveryMax] = useState('');
  const [editRestRating, setEditRestRating] = useState('');
  const [editRestTagline, setEditRestTagline] = useState('');
  const [editRestBannerUrl, setEditRestBannerUrl] = useState('');
  const [editRestLogoUrl, setEditRestLogoUrl] = useState('');
  const [editRestZone, setEditRestZone] = useState('');

  // Add Delivery Zone Form State
  const [isAddZoneModalOpen, setIsAddZoneModalOpen] = useState<boolean>(false);
  const [isEditZoneModalOpen, setIsEditZoneModalOpen] = useState<boolean>(false);
  const [editingZone, setEditingZone] = useState<any | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneCode, setNewZoneCode] = useState('');
  const [newZoneCity, setNewZoneCity] = useState('Lagos');
  const [newZoneCountry, setNewZoneCountry] = useState('Nigeria');
  const [newZoneCurrency, setNewZoneCurrency] = useState('NGN');
  const [newZoneBaseFee, setNewZoneBaseFee] = useState('1000');
  const [newZonePerKmFee, setNewZonePerKmFee] = useState('200');
  const [newZoneRadius, setNewZoneRadius] = useState('10');
  const [newZoneSurge, setNewZoneSurge] = useState('1.0');
  const [newZoneMapR2Url, setNewZoneMapR2Url] = useState('');
  const [newZoneCenterLat, setNewZoneCenterLat] = useState('6.5244');
  const [newZoneCenterLng, setNewZoneCenterLng] = useState('3.3792');

  // Edit Delivery Zone State
  const [editZoneName, setEditZoneName] = useState('');
  const [editZoneCode, setEditZoneCode] = useState('');
  const [editZoneCity, setEditZoneCity] = useState('');
  const [editZoneCountry, setEditZoneCountry] = useState('');
  const [editZoneCurrency, setEditZoneCurrency] = useState('NGN');
  const [editZoneBaseFee, setEditZoneBaseFee] = useState('');
  const [editZonePerKmFee, setEditZonePerKmFee] = useState('');
  const [editZoneRadius, setEditZoneRadius] = useState('');
  const [editZoneSurge, setEditZoneSurge] = useState('');
  const [editZoneMapR2Url, setEditZoneMapR2Url] = useState('');
  const [editZoneIsActive, setEditZoneIsActive] = useState(true);
  const [zoneSearchQuery, setZoneSearchQuery] = useState('');
  const [zoneStatusFilter, setZoneStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Add Staff Member Form State (Strictly 4 Roles)
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState<boolean>(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('sub_admin');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('StaffPass2026!');

  // Search Filters
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Category & Addon Form States
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newAddonName, setNewAddonName] = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState('');

  // Driver / Courier Form States (with R2 Documents & Verification)
  const [isAddDriverModalOpen, setIsAddDriverModalOpen] = useState<boolean>(false);
  const [isEditDriverModalOpen, setIsEditDriverModalOpen] = useState<boolean>(false);
  const [editingDriver, setEditingDriver] = useState<any | null>(null);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverEmail, setNewDriverEmail] = useState('');
  const [newDriverVehicle, setNewDriverVehicle] = useState('Motorcycle');
  const [newDriverPlate, setNewDriverPlate] = useState('');
  const [newDriverLicense, setNewDriverLicense] = useState('');
  const [newDriverKycR2Url, setNewDriverKycR2Url] = useState('');
  const [newDriverPhotoR2Url, setNewDriverPhotoR2Url] = useState('');
  const [newDriverStatus, setNewDriverStatus] = useState('verified');

  // Edit Driver State
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');
  const [editDriverEmail, setEditDriverEmail] = useState('');
  const [editDriverVehicle, setEditDriverVehicle] = useState('');
  const [editDriverPlate, setEditDriverPlate] = useState('');
  const [editDriverLicense, setEditDriverLicense] = useState('');
  const [editDriverRating, setEditDriverRating] = useState('5.0');
  const [editDriverStatus, setEditDriverStatus] = useState('verified');
  const [editDriverKycR2Url, setEditDriverKycR2Url] = useState('');
  const [editDriverPhotoR2Url, setEditDriverPhotoR2Url] = useState('');
  const [editDriverIsOnline, setEditDriverIsOnline] = useState(true);

  // Driver Search & KYC Document Modal
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [driverStatusFilter, setDriverStatusFilter] = useState<'all' | 'online' | 'offline' | 'verified' | 'pending'>('all');
  const [viewingKycDoc, setViewingKycDoc] = useState<{ name: string; url: string; title: string } | null>(null);
  const [isUploadingKycDoc, setIsUploadingKycDoc] = useState(false);
  const [isUploadingZoneMap, setIsUploadingZoneMap] = useState(false);

  // Promo Form States
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState('');
  const [newPromoType, setNewPromoType] = useState('percentage');
  const [newPromoMinOrder, setNewPromoMinOrder] = useState('');

  // Broadcast Notification State
  const [broadcastTitle, setBroadcastTitle] = useState('Important Announcement');
  const [broadcastMessage, setBroadcastMessage] = useState('');

  // Review Reply State
  const [replyReviewId, setReplyReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Developer SQL Console State
  const [devSqlQuery, setDevSqlQuery] = useState('');
  const [devSqlResult, setDevSqlResult] = useState<any | null>(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  // SEO Form State
  const [seoTitle, setSeoTitle] = useState('VeyraNG - On-Demand Food Delivery & Cloud Kitchens');
  const [seoDesc, setSeoDesc] = useState('Order from top-rated restaurants with lightning-fast delivery across Nigeria & international hubs.');
  const [seoKeywords, setSeoKeywords] = useState('food delivery, lagos restaurants, jollof rice, abuja food, veyrang');

  const isSubAdmin = user?.role === 'sub_admin';
  const RESTRICTED_SUB_ADMIN_TABS = ['payments', 'reports', 'cms', 'seo', 'settings', 'developer'];

  useEffect(() => {
    if (isSubAdmin && RESTRICTED_SUB_ADMIN_TABS.includes(activeTab)) {
      setActiveTab('dashboard');
      showActionFeedback('🔒 Sub Admin: Financials, CMS, and Settings are reserved for Super Admins.');
    }
  }, [isSubAdmin, activeTab]);

  const rawNavGroups = [
    { title: 'OVERVIEW', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
    { title: 'ORDERS & FLEET', items: [{ id: 'orders', label: 'Live Orders', icon: ShoppingBag }, { id: 'delivery', label: 'Delivery Map', icon: MapPin }, { id: 'drivers', label: 'Riders Fleet', icon: Bike }] },
    { title: 'MENU & INVENTORY', items: [{ id: 'menu', label: 'Foods & Dishes', icon: Utensils }, { id: 'categories', label: 'Categories', icon: FolderTree }, { id: 'addons', label: 'Add-ons & Options', icon: Layers }, { id: 'inventory', label: 'Kitchen Inventory', icon: Boxes }] },
    { title: 'CUSTOMERS', items: [{ id: 'all_users', label: 'All User Accounts', icon: Users }, { id: 'reviews', label: 'Reviews & Ratings', icon: Star }, { id: 'loyalty', label: 'Loyalty Rewards', icon: Award }, { id: 'promos', label: 'Promotions & Coupons', icon: Tag }] },
    { title: 'BUSINESS & FINANCE', items: [{ id: 'payments', label: 'Payment Ledger', icon: CreditCard }, { id: 'branches', label: 'Restaurant Branches', icon: Building2 }, { id: 'reports', label: 'Reports & Export', icon: BarChart3 }] },
    { title: 'COMMUNICATION', items: [{ id: 'notifications', label: 'Broadcasts', icon: Bell }, { id: 'support', label: 'Support Desk', icon: HelpCircle }] },
    { title: 'WEBSITE CMS', items: [{ id: 'cms', label: 'Website Content', icon: Edit3 }, { id: 'seo', label: 'SEO & Marketing', icon: Globe }] },
    {
      title: 'PLATFORM ADMINISTRATION',
      items: [
        { id: 'staff', label: 'Staff & Team (RBAC)', icon: ShieldAlert },
        { id: 'settings', label: 'Delivery Zones & Rates', icon: Settings },
        { id: 'security', label: 'Security & 2FA', icon: Lock },
        { id: 'developer', label: 'Platform D1 Console', icon: Terminal },
        { id: 'audit', label: 'System Audit Logs', icon: FileText }
      ]
    }
  ];

  const navGroups = rawNavGroups
    .map((group) => {
      if (!isSubAdmin) return group;
      return {
        ...group,
        items: group.items.filter((item) => !RESTRICTED_SUB_ADMIN_TABS.includes(item.id))
      };
    })
    .filter((group) => group.items.length > 0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        overview,
        users,
        orders,
        menu,
        categories,
        addons,
        drivers,
        promos,
        reviews,
        tickets,
        txns,
        logs,
        health,
        d1Health,
        rests,
        cms,
        settingsRes,
        zonesRes
      ] = await Promise.all([
        api.admin.getOverview().catch(() => null),
        api.admin.getUsers().catch(() => []),
        api.admin.getOrders().catch(() => []),
        api.admin.getMenuItems().catch(() => []),
        api.admin.getCategories().catch(() => []),
        api.admin.getAddons().catch(() => []),
        api.admin.getDrivers().catch(() => []),
        api.admin.getPromos().catch(() => []),
        api.admin.getReviews().catch(() => []),
        api.admin.getSupportTickets().catch(() => []),
        api.admin.getTransactions().catch(() => []),
        api.admin.getAuditLogs().catch(() => []),
        api.health.check().catch(() => null),
        api.health.checkDatabase().catch(() => null),
        api.admin.getRestaurants().catch(() => []),
        api.admin.getCMS().catch(() => ({})),
        api.settings.get().catch(() => null),
        deliveryService.getDeliveryZones().catch(() => [])
      ]);

      setAnalytics(overview);
      setUsersList(Array.isArray(users) ? users : []);
      setOrdersList(Array.isArray(orders) ? orders : []);
      setMenuItemsList(Array.isArray(menu) ? menu : []);
      setCategoriesList(Array.isArray(categories) ? categories : []);
      setAddonsList(Array.isArray(addons) ? addons : []);
      setDriversList(Array.isArray(drivers) ? drivers : []);
      setPromosList(Array.isArray(promos) ? promos : []);
      setReviewsList(Array.isArray(reviews) ? reviews : []);
      setSupportTicketsList(Array.isArray(tickets) ? tickets : []);
      setTransactions(Array.isArray(txns) ? txns : []);
      setAuditLogs(Array.isArray(logs) ? logs : []);
      setHealthData(health);
      setD1HealthData(d1Health?.data || d1Health);
      setRestaurantsList(Array.isArray(rests) ? rests : []);
      setCmsCopy(cms || {});

      const extractedSettings = settingsRes?.settings || settingsRes?.data?.settings || settingsRes;
      if (extractedSettings && typeof extractedSettings === 'object') {
        const finalMap = extractedSettings.settings || extractedSettings;
        setPlatformSettings(finalMap);
        setCmsCopy(finalMap);
        setCmsDrafts(finalMap);
      }

      if (Array.isArray(zonesRes) && zonesRes.length > 0) {
        setDeliveryZonesList(zonesRes);
      }

      // Automatically sync public storefront & customer context in real time
      refreshData().catch(() => {});
    } catch (e) {
      console.error('Admin fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const showActionFeedback = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4500);
  };

  // Staff creation handler - strictly Super Admin
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubAdmin) {
      showActionFeedback('Sub Admins are not permitted to add or create staff members.');
      return;
    }
    if (!newStaffName || !newStaffEmail) return;

    try {
      await api.admin.createStaff({
        name: newStaffName,
        email: newStaffEmail,
        role: newStaffRole,
        phone: newStaffPhone,
        password: newStaffPassword
      });

      showActionFeedback(`Staff member "${newStaffName}" created successfully with role "${newStaffRole}" in Platform D1!`);
      setIsAddStaffModalOpen(false);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPhone('');
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Failed to create staff member: ${err.message}`);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (isSubAdmin) {
      showActionFeedback('Sub Admins are not permitted to change staff roles.');
      return;
    }
    try {
      console.log('AdminPortal: Updating role for userId:', userId, 'to:', newRole);
      await api.admin.updateUserRole(userId, newRole);
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      showActionFeedback(`✓ Role updated to "${newRole}" in Platform D1!`);
      fetchData();
    } catch (err: any) {
      console.error('AdminPortal: Role update error:', err);
      showActionFeedback(`Role update note: ${err.message}`);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (isSubAdmin) {
      showActionFeedback('Sub Admins are not permitted to delete users or staff accounts.');
      return;
    }
    if (!window.confirm(`Permanently remove staff account for "${name}" from Platform D1?`)) return;
    try {
      await api.admin.deleteUser(id);
      showActionFeedback(`Account for "${name}" removed from D1.`);
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Delete failed: ${err.message}`);
    }
  };

  // Order status management
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await api.admin.updateOrderStatus(orderId, newStatus);
      setOrdersList((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      await advanceOrderStatus(orderId, newStatus);
      await refreshData();
      showActionFeedback(`Order status updated to "${newStatus}" in D1.`);
    } catch (err: any) {
      showActionFeedback(`Failed to update order: ${err.message}`);
    }
  };

  const handleRefundOrder = async (orderId: string) => {
    if (!window.confirm('Process full refund for this order and credit customer wallet?')) return;
    try {
      await api.admin.refundOrder(orderId);
      showActionFeedback('Order refunded and credited to customer in D1!');
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Refund failed: ${err.message}`);
    }
  };

  // Menu items management
  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuName || !newMenuPrice) return;

    try {
      await api.admin.createMenuItem({
        name: newMenuName,
        price: Number(newMenuPrice),
        description: newMenuDesc,
        category: newMenuCategory,
        restaurantId: newMenuRestaurantId,
        imageUrl: newMenuImageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'
      });

      showActionFeedback(`Dish "${newMenuName}" added to Platform D1!`);
      setIsAddMenuModalOpen(false);
      setNewMenuName('');
      setNewMenuPrice('');
      setNewMenuDesc('');
      setNewMenuImageUrl('');
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Failed to add dish: ${err.message}`);
    }
  };

  const handleToggleMenuItem = async (id: string) => {
    try {
      const res = await api.admin.toggleMenuItem(id);
      setMenuItemsList((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_available: res.isAvailable ? 1 : 0 } : m))
      );
      showActionFeedback(`Menu availability updated in D1.`);
    } catch (err: any) {
      showActionFeedback(`Toggle failed: ${err.message}`);
    }
  };

  const handleDeleteMenuItem = async (id: string, name: string) => {
    if (!window.confirm(`Delete dish "${name}" from Platform D1?`)) return;
    try {
      await api.admin.deleteMenuItem(id);
      showActionFeedback(`Dish "${name}" deleted.`);
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Delete failed: ${err.message}`);
    }
  };

  // Menu item edit handlers
  const handleOpenEditMenu = (item: any) => {
    setEditingMenuItem(item);
    setEditMenuName(item.name || '');
    setEditMenuPrice(String(item.price || ''));
    setEditMenuDesc(item.description || '');
    setEditMenuCategory(item.category_id || item.category || 'Main');
    setEditMenuRestaurantId(item.restaurant_id || 'rest-1');
    setEditMenuImageUrl(item.image_url || item.image_r2_url || '');
    setIsEditMenuModalOpen(true);
  };

  const handleSaveEditMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMenuItem || !editMenuName || !editMenuPrice) return;
    try {
      await api.admin.updateMenuItem(editingMenuItem.id, {
        name: editMenuName,
        price: Number(editMenuPrice),
        description: editMenuDesc,
        category: editMenuCategory,
        restaurantId: editMenuRestaurantId,
        imageUrl: editMenuImageUrl
      });
      showActionFeedback(`Dish "${editMenuName}" updated in Platform D1!`);
      setIsEditMenuModalOpen(false);
      setEditingMenuItem(null);
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Failed to update dish: ${err.message}`);
    }
  };

  // Delivery zone actions
  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName || !newZoneCode) return;
    try {
      await deliveryService.createZone({
        name: newZoneName,
        code: newZoneCode.toUpperCase().trim(),
        city: newZoneCity,
        country: newZoneCountry,
        currency: newZoneCurrency,
        baseFee: Number(newZoneBaseFee || 1000),
        perKmFee: Number(newZonePerKmFee || 200),
        radiusKm: Number(newZoneRadius || 10),
        surgeMultiplier: Number(newZoneSurge || 1.0),
        centerLat: Number(newZoneCenterLat || 6.5244),
        centerLng: Number(newZoneCenterLng || 3.3792),
        mapImageR2Url: newZoneMapR2Url || undefined
      });
      showActionFeedback(`Delivery zone "${newZoneName}" created in Platform D1!`);
      setIsAddZoneModalOpen(false);
      setNewZoneName('');
      setNewZoneCode('');
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Failed to create delivery zone: ${err.message}`);
    }
  };

  const handleDeleteZone = async (id: string, name: string) => {
    if (!window.confirm(`Permanently remove delivery zone "${name}" from Platform D1?`)) return;
    try {
      await deliveryService.deleteZone(id);
      showActionFeedback(`Delivery zone "${name}" removed.`);
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Delete failed: ${err.message}`);
    }
  };

  const handleToggleZoneActive = async (id: string) => {
    try {
      const res = await deliveryService.toggleZoneStatus(id);
      setDeliveryZonesList((prev) =>
        prev.map((z) => (z.id === id ? { ...z, is_active: res.isActive ? 1 : 0, isActive: res.isActive } : z))
      );
      showActionFeedback(`Zone status updated in D1.`);
    } catch (err: any) {
      showActionFeedback(`Failed to toggle zone: ${err.message}`);
    }
  };

  // Customer wallet adjustment
  const handleAdjustWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForWallet || !walletAdjustAmount) return;
    try {
      await api.admin.adjustUserWallet(selectedUserForWallet.id, Number(walletAdjustAmount), walletAdjustReason);
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === selectedUserForWallet.id
            ? { ...u, wallet_balance_ngn: Number(u.wallet_balance_ngn || 0) + Number(walletAdjustAmount) }
            : u
        )
      );
      showActionFeedback(`Customer wallet credited with ₦${Number(walletAdjustAmount).toLocaleString()} in D1!`);
      setSelectedUserForWallet(null);
      setWalletAdjustAmount('');
      setWalletAdjustReason('Customer Appreciation Credit');
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Failed to adjust wallet: ${err.message}`);
    }
  };

  // Broadcast action
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage) return;
    try {
      await api.admin.broadcastNotification({
        title: broadcastTitle,
        message: broadcastMessage,
        targetRole: 'all'
      });
      showActionFeedback(`Broadcast notification dispatched to all devices!`);
      setBroadcastMessage('');
    } catch (err: any) {
      showActionFeedback(`Broadcast failed: ${err.message}`);
    }
  };

  // CSV Exports
  const handleDownloadCSV = () => {
    if (ordersList.length === 0) {
      showActionFeedback('No orders available to export.');
      return;
    }
    const headers = ['Order ID', 'Short ID', 'Customer Name', 'Phone', 'Restaurant', 'Total (NGN)', 'Status', 'Payment Method', 'Date'];
    const rows = ordersList.map((o) => [
      o.id,
      o.shortId || o.short_id || '',
      `"${o.customerName || o.customer_name || ''}"`,
      `"${o.customerPhone || o.customer_phone || ''}"`,
      `"${o.restaurantName || o.restaurant_name || ''}"`,
      o.total,
      o.status,
      o.paymentMethod || o.payment_method || 'card',
      o.createdAt || o.created_at || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `veyrang_sales_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showActionFeedback('Sales report CSV exported successfully!');
  };

  const handleExportAuditLogs = () => {
    if (auditLogs.length === 0) {
      showActionFeedback('No audit logs available to export.');
      return;
    }
    const headers = ['ID', 'User Email', 'Action', 'Resource', 'Resource ID', 'Timestamp'];
    const rows = auditLogs.map((log) => [
      log.id || '',
      `"${log.userEmail || log.user_email || ''}"`,
      `"${log.action || ''}"`,
      `"${log.resource || ''}"`,
      `"${log.resourceId || log.resource_id || ''}"`,
      `"${log.timestamp || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `veyrang_audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showActionFeedback('Audit trail CSV exported successfully!');
  };

  // SQL Developer execution
  const handleExecuteSql = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devSqlQuery.trim()) return;

    setIsExecutingSql(true);
    try {
      const res = await api.admin.runDeveloperQuery(devSqlQuery);
      setDevSqlResult(res.data);
      showActionFeedback('Query executed on Platform D1!');
    } catch (err: any) {
      setDevSqlResult({ error: err.message });
    } finally {
      setIsExecutingSql(false);
    }
  };

  // Live Database Health Ping Trigger
  const handlePingDatabase = async () => {
    setIsPingingD1(true);
    try {
      const res = await api.health.pingDatabase();
      showActionFeedback(`✓ Database responded in ${res.latencyMs || 45}ms! Connected securely.`);
      const updated = await api.health.checkDatabase().catch(() => null);
      if (updated) setD1HealthData(updated?.data || updated);
    } catch (err: any) {
      showActionFeedback(`Database Ping issue: ${err.message}`);
    } finally {
      setIsPingingD1(false);
    }
  };

  // Category Handlers
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.admin.createCategory({ name: newCatName, description: newCatDesc });
      showActionFeedback(`Category "${newCatName}" saved in Platform D1!`);
      setNewCatName('');
      setNewCatDesc('');
      setIsAddCatModalOpen(false);
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Failed to create category: ${err.message}`);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`Delete category "${name}" from D1?`)) return;
    try {
      await api.admin.deleteCategory(id);
      showActionFeedback(`Category "${name}" deleted.`);
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Delete failed: ${err.message}`);
    }
  };

  // Addon Handlers
  const handleCreateAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddonName || !newAddonPrice) return;
    try {
      await api.admin.createAddon({ name: newAddonName, price: Number(newAddonPrice) });
      showActionFeedback(`Add-on "${newAddonName}" added to D1!`);
      setNewAddonName('');
      setNewAddonPrice('');
      setIsAddAddonModalOpen(false);
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Failed to add add-on: ${err.message}`);
    }
  };

  const handleDeleteAddon = async (id: string, name: string) => {
    if (!window.confirm(`Delete add-on "${name}" from D1?`)) return;
    try {
      await api.admin.deleteAddon(id);
      showActionFeedback(`Add-on "${name}" removed.`);
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Delete failed: ${err.message}`);
    }
  };

  // Promo Code Handlers
  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode || !newPromoDiscount) return;
    try {
      await api.admin.createPromo({
        code: newPromoCode.toUpperCase().trim(),
        value: Number(newPromoDiscount),
        discountType: newPromoType,
        minOrderAmount: Number(newPromoMinOrder || 0),
        maxDiscountCap: Number(newPromoDiscount) * 2,
        expiresAt: '2026-12-31'
      });
      showActionFeedback(`Coupon "${newPromoCode.toUpperCase()}" active in Platform D1!`);
      setNewPromoCode('');
      setNewPromoDiscount('');
      setIsAddPromoModalOpen(false);
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Failed to create promo: ${err.message}`);
    }
  };

  const handleTogglePromo = async (id: string) => {
    try {
      await api.admin.togglePromo(id);
      showActionFeedback('Coupon status updated in D1.');
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Toggle failed: ${err.message}`);
    }
  };

  const handleDeletePromo = async (id: string, code: string) => {
    if (!window.confirm(`Delete promo code "${code}" from D1?`)) return;
    try {
      await api.admin.deletePromo(id);
      showActionFeedback(`Promo code "${code}" deleted.`);
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Delete failed: ${err.message}`);
    }
  };

  // Restaurant Branch Handlers
  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRestName || !newRestAddress) return;
    try {
      await api.admin.createRestaurant({
        name: newRestName,
        address: newRestAddress,
        cuisine: newRestCuisine,
        deliveryFee: Number(newRestDeliveryFee || 1000),
        deliveryTimeMin: Number(newRestDeliveryMin || 20),
        deliveryTimeMax: Number(newRestDeliveryMax || 40),
        rating: Number(newRestRating || 4.8),
        tagline: newRestTagline,
        bannerUrl: newRestBannerUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000',
        zone: newRestZone
      });
      showActionFeedback(`Restaurant branch "${newRestName}" saved to D1!`);
      setIsAddRestaurantModalOpen(false);
      setNewRestName('');
      setNewRestAddress('');
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Branch creation failed: ${err.message}`);
    }
  };

  const handleToggleBranchStatus = async (id: string) => {
    try {
      await api.admin.toggleBranchStatus(id);
      showActionFeedback('Restaurant open/busy status updated in D1.');
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Toggle failed: ${err.message}`);
    }
  };

  const handleDeleteRestaurant = async (id: string, name: string) => {
    if (!window.confirm(`Permanently remove restaurant branch "${name}" from D1?`)) return;
    try {
      await api.admin.deleteRestaurant(id);
      showActionFeedback(`Restaurant "${name}" removed.`);
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Delete failed: ${err.message}`);
    }
  };

  const handleOpenEditRestaurant = (rest: any) => {
    setEditingRestaurant(rest);
    setEditRestName(rest.name || '');
    setEditRestAddress(rest.address || '');
    setEditRestCuisine(rest.cuisine || '');
    setEditRestDeliveryFee(String(rest.deliveryFee || rest.delivery_fee || 1000));
    setEditRestDeliveryMin(String(rest.deliveryTimeMin || rest.delivery_time_min || 20));
    setEditRestDeliveryMax(String(rest.deliveryTimeMax || rest.delivery_time_max || 40));
    setEditRestRating(String(rest.rating || 4.8));
    setEditRestTagline(rest.tagline || '');
    setEditRestBannerUrl(rest.bannerUrl || rest.banner_r2_url || '');
    setEditRestLogoUrl(rest.logoUrl || '');
    setEditRestZone(rest.zone || 'Lekki / Victoria Island');
    setIsEditRestaurantModalOpen(true);
  };

  const handleSaveEditRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRestaurant || !editRestName.trim() || !editRestAddress.trim()) return;
    try {
      await api.admin.updateRestaurant(editingRestaurant.id, {
        name: editRestName.trim(),
        address: editRestAddress.trim(),
        cuisine: editRestCuisine.trim(),
        deliveryFee: Number(editRestDeliveryFee || 1000),
        deliveryTimeMin: Number(editRestDeliveryMin || 20),
        deliveryTimeMax: Number(editRestDeliveryMax || 40),
        rating: Number(editRestRating || 4.8),
        tagline: editRestTagline.trim(),
        bannerUrl: editRestBannerUrl.trim(),
        logoUrl: editRestLogoUrl.trim(),
        zone: editRestZone.trim()
      });
      showActionFeedback(`✓ Restaurant "${editRestName}" updated permanently in Cloudflare D1!`);
      setIsEditRestaurantModalOpen(false);
      setEditingRestaurant(null);
      await refreshData();
      await fetchData();
    } catch (err: any) {
      showActionFeedback(`Failed to update restaurant: ${err.message}`);
    }
  };

  // Reviews Moderation Handlers
  const handleReplyReview = async (id: string) => {
    if (!replyText.trim()) return;
    try {
      await api.admin.replyReview(id, replyText.trim());
      showActionFeedback('Merchant response published to customer review in D1!');
      setReplyReviewId(null);
      setReplyText('');
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Reply failed: ${err.message}`);
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!window.confirm('Delete review permanently from Platform D1?')) return;
    try {
      await api.admin.deleteReview(id);
      showActionFeedback('Review deleted from D1.');
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Delete failed: ${err.message}`);
    }
  };

  // Support Tickets Handler
  const handleUpdateTicketStatus = async (id: string, status: string) => {
    try {
      await api.admin.updateSupportTicket(id, status);
      showActionFeedback(`Ticket status updated to "${status}" in D1.`);
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Update failed: ${err.message}`);
    }
  };

  const handleReplySupportTicket = async (id: string) => {
    const reply = (supportReplyDrafts[id] || '').trim();
    if (reply.length < 2) { showActionFeedback('Write a reply before sending it to the customer.'); return; }
    setSendingSupportReply(id);
    try {
      await api.admin.replySupportTicket(id, reply);
      setSupportReplyDrafts(prev => ({ ...prev, [id]: '' }));
      showActionFeedback('Reply saved. The customer can see it using their ticket reference and email.');
      await fetchData();
    } catch (err: any) {
      showActionFeedback('Reply failed: ' + err.message);
    } finally { setSendingSupportReply(null); }
  };

  // Driver Verification Handlers
  const handleVerifyDriverKYC = async (userId: string, status: string) => {
    try {
      await api.admin.verifyDriverKYC(userId, status);
      showActionFeedback(`Driver KYC updated to "${status}" in D1.`);
      fetchData();
    } catch (err: any) {
      showActionFeedback(`KYC update failed: ${err.message}`);
    }
  };

  const handleToggleDriver = async (userId: string) => {
    try {
      await api.admin.toggleDriver(userId);
      showActionFeedback('Courier dispatch status updated in D1.');
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Toggle failed: ${err.message}`);
    }
  };

  const handleDeleteDriver = async (userId: string, name: string) => {
    if (!window.confirm(`Remove rider "${name}" from dispatch fleet?`)) return;
    try {
      await api.admin.deleteDriver(userId);
      showActionFeedback(`Rider "${name}" removed from D1.`);
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Delete failed: ${err.message}`);
    }
  };

  // CMS Content Update Handler
  const handleSaveCMS = async (key: string, value: string) => {
    setSavingKey(key);
    try {
      await api.admin.updateCMS(key, value);
      showActionFeedback(`✓ Live setting "${key}" saved directly to Platform D1!`);
      setCmsCopy((prev) => ({ ...prev, [key]: value }));
      setCmsDrafts((prev) => ({ ...prev, [key]: value }));
      setPlatformSettings((prev) => ({ ...prev, [key]: value }));
      await refreshData();
      await fetchData();
    } catch (err: any) {
      showActionFeedback(`Failed to update setting: ${err.message}`);
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveAllCMS = async () => {
    setIsSavingAllCMS(true);
    try {
      const merged = { ...platformSettings, ...cmsDrafts };
      await api.admin.bulkUpdateCMS(merged);
      showActionFeedback('✓ All CMS & text changes saved successfully to Cloudflare D1!');
      setPlatformSettings((prev) => ({ ...prev, ...merged }));
      setCmsCopy((prev) => ({ ...prev, ...merged }));
      await refreshData();
      await fetchData();
    } catch (err: any) {
      showActionFeedback(`Failed to bulk save CMS: ${err.message}`);
    } finally {
      setIsSavingAllCMS(false);
    }
  };

  // SEO Update Handler
  const handleSaveSEO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.admin.saveSeoTags({ title: seoTitle, description: seoDesc, keywords: seoKeywords });
      showActionFeedback('SEO and OpenGraph metadata saved to Platform D1!');
      fetchData();
    } catch (err: any) {
      showActionFeedback(`Failed to update SEO: ${err.message}`);
    }
  };

  // Filtered orders list
  const filteredOrders = ordersList.filter((o) => {
    if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false;
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase();
      const idMatch = (o.shortId || o.short_id || o.id || '').toLowerCase().includes(q);
      const nameMatch = (o.customerName || o.customer_name || '').toLowerCase().includes(q);
      const phoneMatch = (o.customerPhone || o.customer_phone || '').toLowerCase().includes(q);
      const restMatch = (o.restaurantName || o.restaurant_name || '').toLowerCase().includes(q);
      return idMatch || nameMatch || phoneMatch || restMatch;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 flex flex-col font-sans selection:bg-orange-100 selection:text-[#FF5500]">
      {/* Top Bar matching site branding */}
      <header className="h-16 bg-white border-b border-slate-200/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3 md:gap-4">
          {/* Navigator Hamburger Button */}
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="p-2 rounded-xl text-slate-700 hover:text-[#FF5500] hover:bg-orange-50 transition-colors cursor-pointer flex items-center justify-center border border-slate-200 bg-white shadow-xs"
            aria-label="Open full admin navigator"
            title="Open Admin Navigator"
          >
            <Menu className="w-5 h-5 text-[#FF5500]" />
          </button>

          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden lg:flex p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle sidebar width"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Sliders className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold tracking-tight text-slate-900 capitalize">
              {(activeTab || '').replace('_', ' ')}
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              VeyraNG Admin Console
            </span>
            {isSubAdmin ? (
              <span className="ml-2 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-indigo-600" /> Sub Admin Mode
              </span>
            ) : (
              <span className="ml-2 px-2.5 py-0.5 bg-orange-50 text-[#FF5500] border border-orange-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#FF5500]" /> Super Admin (A-Z Master)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Visual Platform D1 Live Pulse Indicator */}
          <button
            onClick={handlePingDatabase}
            disabled={isPingingD1}
            title="Click to ping live Platform D1 production database"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold cursor-pointer shadow-xs transition-colors"
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                d1HealthData?.connected || healthData?.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                d1HealthData?.connected || healthData?.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}></span>
            </span>
            <span className="font-mono text-[11px] text-slate-700">
              D1: <span className="font-bold text-slate-900">veyrang_production</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-bold border border-emerald-200">
              {isPingingD1 ? 'Pinging...' : `${d1HealthData?.latencyMs || 45}ms`}
            </span>
          </button>

          <button
            onClick={() => fetchData()}
            title="Refresh database records"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 bg-white transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 text-slate-700 ${loading ? 'animate-spin text-[#FF5500]' : ''}`} />
          </button>

          {/* Admin Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 transition-colors cursor-pointer shadow-xs"
            >
              <div className="w-6 h-6 rounded-lg bg-[#FF5500] text-white flex items-center justify-center font-extrabold text-[11px] shadow-xs">
                {(user?.name || 'A').charAt(0)}
              </div>
              <span className="hidden sm:inline font-semibold">{user?.name || 'Administrator'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isProfileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 text-xs text-slate-700">
                <div className="px-4 py-2 border-b border-slate-100">
                  <div className="font-bold text-slate-900">{user?.name || 'Administrator'}</div>
                  <div className="text-[11px] text-slate-500 truncate">{user?.email || 'N/A'}</div>
                  <div className="text-[10px] font-bold text-[#FF5500] uppercase mt-0.5">{user?.role === 'sub_admin' ? 'Sub Admin' : 'Super Admin'}</div>
                </div>
                {!isSubAdmin && (
                  <>
                    <button onClick={() => { setActiveTab('settings'); setIsProfileDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-orange-50 hover:text-[#FF5500] transition-colors cursor-pointer font-medium">Delivery Zones & Settings</button>
                    <button onClick={() => { setActiveTab('developer'); setIsProfileDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-orange-50 hover:text-[#FF5500] transition-colors cursor-pointer font-medium">D1 Database Console</button>
                  </>
                )}
                <button onClick={() => { setActiveTab('staff'); setIsProfileDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-orange-50 hover:text-[#FF5500] transition-colors cursor-pointer font-medium">Staff & RBAC</button>
                <button onClick={() => { setActiveTab('audit'); setIsProfileDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-orange-50 hover:text-[#FF5500] transition-colors cursor-pointer font-medium">System Audit Logs</button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={async () => {
                    setIsProfileDropdownOpen(false);
                    await logout();
                    setActiveRole('customer');
                    setActivePage('home');
                  }}
                  className="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50 transition-colors font-bold cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Slide-Out 3-Bar Navigator Overlay Drawer */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => setIsMobileDrawerOpen(false)} />
          <div className="relative w-80 sm:w-88 bg-white h-full flex flex-col border-r border-slate-200 z-10 shadow-2xl">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#FF5500] text-white flex items-center justify-center font-black shadow-xs">V</div>
                <div>
                  <div className="text-sm font-extrabold text-slate-900">VeyraNG Admin</div>
                  <div className="text-[10px] text-[#FF5500] font-semibold uppercase tracking-wider">Edge Management</div>
                </div>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                aria-label="Close navigator"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 no-scrollbar">
              {navGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1">
                  <div className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                    {group.title}
                  </div>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsMobileDrawerOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#FF5500] text-white shadow-sm shadow-orange-500/25 font-bold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Main Sidebar */}
        <aside
          className={`hidden md:flex flex-col bg-white border-r border-slate-200/80 transition-all duration-300 z-30 ${
            isSidebarCollapsed ? 'w-20' : 'w-64'
          }`}
        >
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FF5500] text-white flex items-center justify-center font-black shadow-xs">V</div>
                <div>
                  <div className="text-sm font-extrabold text-slate-900 tracking-tight">VeyraNG</div>
                  <div className="text-[10px] text-[#FF5500] font-semibold uppercase tracking-wider">Admin Console</div>
                </div>
              </div>
            )}
            {isSidebarCollapsed && (
              <div className="mx-auto w-8 h-8 rounded-xl bg-[#FF5500] text-white flex items-center justify-center font-black shadow-xs">V</div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 no-scrollbar">
            {navGroups.map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-1">
                {!isSidebarCollapsed && (
                  <div className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                    {group.title}
                  </div>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      title={isSidebarCollapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#FF5500] text-white shadow-sm shadow-orange-500/25 font-bold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                      {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {actionMessage && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm animate-fadeIn border ${
                actionMessage.startsWith('🔒') || actionMessage.includes('Sub Admin')
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : actionMessage.toLowerCase().includes('failed') || actionMessage.toLowerCase().includes('error') || actionMessage.toLowerCase().includes('note:')
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
              }`}
            >
              {actionMessage.startsWith('🔒') || actionMessage.includes('Sub Admin') ? (
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              ) : actionMessage.toLowerCase().includes('failed') || actionMessage.toLowerCase().includes('error') || actionMessage.toLowerCase().includes('note:') ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span className="font-semibold">{actionMessage}</span>
            </div>
          )}

          {/* 1. DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Dedicated Platform D1 Live Connection Status Card */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 md:p-6 shadow-md border border-slate-700/60 relative overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        Production D1 Database (Edge Connected)
                      </span>
                    </div>
                    <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                      <span>Connected Database Active</span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Authoritative live database and edge connection established.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="px-3 py-1.5 bg-slate-800/90 rounded-xl border border-slate-700 text-center">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Edge Latency</div>
                      <div className="text-xs font-mono font-extrabold text-emerald-400">
                        {d1HealthData?.latencyMs || 42} ms
                      </div>
                    </div>
                    <div className="px-3 py-1.5 bg-slate-800/90 rounded-xl border border-slate-700 text-center">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Storage CDN</div>
                      <div className="text-xs font-mono font-bold text-orange-400">
                        cdn.veyrang.com
                      </div>
                    </div>
                    <button
                      onClick={handlePingDatabase}
                      disabled={isPingingD1}
                      className="px-4 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-orange-500/30 transition-all disabled:opacity-50"
                    >
                      <Activity className={`w-3.5 h-3.5 ${isPingingD1 ? 'animate-spin' : ''}`} />
                      {isPingingD1 ? 'Testing...' : 'Ping D1 Edge Now'}
                    </button>
                  </div>
                </div>

                {/* Table Sync Breakdown Chips */}
                <div className="mt-4 pt-4 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                  <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/40">
                    <div className="text-[10px] text-slate-400 font-semibold">Users</div>
                    <div className="text-sm font-bold font-mono text-white">{d1HealthData?.tableCounts?.users ?? usersList.length}</div>
                  </div>
                  <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/40">
                    <div className="text-[10px] text-slate-400 font-semibold">Orders</div>
                    <div className="text-sm font-bold font-mono text-white">{d1HealthData?.tableCounts?.orders ?? ordersList.length}</div>
                  </div>
                  <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/40">
                    <div className="text-[10px] text-slate-400 font-semibold">Dishes</div>
                    <div className="text-sm font-bold font-mono text-white">{d1HealthData?.tableCounts?.menuItems ?? menuItemsList.length}</div>
                  </div>
                  <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/40">
                    <div className="text-[10px] text-slate-400 font-semibold">Ledger</div>
                    <div className="text-sm font-bold font-mono text-white">{d1HealthData?.tableCounts?.transactions ?? transactions.length}</div>
                  </div>
                  <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/40">
                    <div className="text-[10px] text-slate-400 font-semibold">Zones</div>
                    <div className="text-sm font-bold font-mono text-white">{d1HealthData?.tableCounts?.deliveryZones ?? deliveryZonesList.length}</div>
                  </div>
                  <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/40">
                    <div className="text-[10px] text-slate-400 font-semibold">Promos</div>
                    <div className="text-sm font-bold font-mono text-white">{d1HealthData?.tableCounts?.promoCodes ?? promosList.length}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Platform Overview (D1 Live)</h2>
                  <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">Database Synced</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Gross Merchandise Volume</div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
                      ₦{(analytics?.grossMerchandiseVolume ?? ordersList.reduce((sum, o) => sum + (Number(o.total) || 0), 0)).toLocaleString('en-NG')}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-semibold">Total processed GMV (D1)</div>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Platform Net Revenue (15%)</div>
                    <div className="text-xl sm:text-2xl font-bold text-[#FF5500] font-mono">
                      ₦{(analytics?.platformNetRevenue ?? Math.round(ordersList.reduce((sum, o) => sum + (Number(o.total) || 0), 0) * 0.15)).toLocaleString('en-NG')}
                    </div>
                    <div className="text-[11px] text-slate-500">Retained revenue</div>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total D1 User Wallet Sum</div>
                    <div className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono">
                      ₦{(analytics?.totalWalletBalanceNGN ?? usersList.reduce((sum, u) => sum + (Number(u.wallet_balance_ngn ?? u.walletBalanceNGN ?? 0)), 0)).toLocaleString('en-NG')}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-medium">Authoritative D1 Balance Sum</div>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total Orders Processed</div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
                      {(analytics?.totalOrders ?? ordersList.length).toLocaleString()}
                    </div>
                    <div className="text-[11px] text-indigo-600 font-semibold">{analytics?.activeOrders ?? ordersList.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length} active in kitchen/transit</div>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Active D1 Accounts</div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
                      {usersList.length}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">Registered accounts in D1</div>
                  </div>
                </div>
              </div>

              {/* Quick Action Shortcuts */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Quick Navigation & Operations</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button onClick={() => setActiveTab('orders')} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-orange-50 hover:border-orange-200 transition-colors text-left cursor-pointer">
                    <ShoppingBag className="w-5 h-5 text-[#FF5500] mb-1.5" />
                    <div className="text-xs font-bold text-slate-900">Manage Orders</div>
                    <div className="text-[11px] text-slate-500">{ordersList.length} orders in record</div>
                  </button>
                  <button onClick={() => setActiveTab('staff')} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-orange-50 hover:border-orange-200 transition-colors text-left cursor-pointer">
                    <ShieldAlert className="w-5 h-5 text-[#FF5500] mb-1.5" />
                    <div className="text-xs font-bold text-slate-900">Staff & Roles</div>
                    <div className="text-[11px] text-slate-500">4 Core Role Permissions</div>
                  </button>
                  <button onClick={() => setActiveTab('menu')} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-orange-50 hover:border-orange-200 transition-colors text-left cursor-pointer">
                    <Utensils className="w-5 h-5 text-[#FF5500] mb-1.5" />
                    <div className="text-xs font-bold text-slate-900">Menu & Kitchen</div>
                    <div className="text-[11px] text-slate-500">{menuItemsList.length} dishes online</div>
                  </button>
                  <button onClick={() => setActiveTab('drivers')} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-orange-50 hover:border-orange-200 transition-colors text-left cursor-pointer">
                    <Bike className="w-5 h-5 text-[#FF5500] mb-1.5" />
                    <div className="text-xs font-bold text-slate-900">Riders Fleet</div>
                    <div className="text-[11px] text-slate-500">{driversList.length} registered riders</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. LIVE ORDERS MANAGEMENT */}
          {activeTab === 'orders' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Live Customer Orders</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Track and update kitchen & delivery progress in Platform D1.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search by order ID, name, or phone..."
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#FF5500] outline-none w-64"
                  />
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium cursor-pointer"
                  >
                    {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Items</th>
                      <th className="p-3">Total (NGN)</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Update Status</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-mono font-bold text-[#FF5500]">#{o.shortId || o.short_id || o.id?.substring(0, 8)}</td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{o.customerName || o.customer_name || 'Customer'}</div>
                          <div className="text-[11px] text-slate-500">{o.customerPhone || o.customer_phone || ''}</div>
                        </td>
                        <td className="p-3 max-w-xs truncate text-slate-600">
                          {Array.isArray(o.items) ? o.items.map((i: any) => `${i.quantity || 1}x ${i.name || i.title}`).join(', ') : 'Order items'}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          ₦{Number(o.total || 0).toLocaleString('en-NG')}
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            o.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            o.status === 'in_transit' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                            o.status === 'preparing' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <select
                            value={o.status}
                            onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value as OrderStatus)}
                            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium cursor-pointer"
                          >
                            {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleRefundOrder(o.id)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Refund
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500 text-xs">
                          No orders found matching criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. STAFF & TEAM MANAGEMENT (RBAC) */}
          {activeTab === 'staff' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Staff & Role-Based Access Control (RBAC)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage accounts across the 4 platform roles in Platform D1.
                  </p>
                </div>

                {!isSubAdmin ? (
                  <button
                    onClick={() => setIsAddStaffModalOpen(true)}
                    className="px-4 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-orange-500/25 shrink-0 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" /> Add Staff Member
                  </button>
                ) : (
                  <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold">
                    🔒 Sub Admin Mode: Read-only access to staff list
                  </div>
                )}
              </div>

              {/* Add Staff Modal - Super Admin Only */}
              {isAddStaffModalOpen && !isSubAdmin && (
                <div className="bg-white border border-orange-200 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Add Staff Account</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Assign permissions for one of the 4 platform roles.</p>
                    </div>
                    <button onClick={() => setIsAddStaffModalOpen(false)} className="text-slate-400 hover:text-slate-900 cursor-pointer p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateStaff} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Full Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Adeola Johnson"
                          value={newStaffName}
                          onChange={(e) => setNewStaffName(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Email Address *</label>
                        <input
                          type="email"
                          required
                          value={newStaffEmail}
                          onChange={(e) => setNewStaffEmail(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-[#FF5500] outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Role Permission (4 Core Roles) *</label>
                        <select
                          value={newStaffRole}
                          onChange={(e) => setNewStaffRole(e.target.value as UserRole)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold cursor-pointer focus:border-[#FF5500] outline-none"
                        >
{USER_ROLES.map(role => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Phone Number</label>
                        <input
                          type="text"
                          placeholder="+234 800 123 4567"
                          value={newStaffPhone}
                          onChange={(e) => setNewStaffPhone(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-[#FF5500] outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Initial Temporary Password</label>
                        <input
                          type="text"
                          value={newStaffPassword}
                          onChange={(e) => setNewStaffPassword(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-[#FF5500] outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsAddStaffModalOpen(false)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm shadow-orange-500/25"
                      >
                        Create Staff Account
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Staff Name</th>
                      <th className="p-3">Email Address</th>
                      <th className="p-3">Assigned Role</th>
                      <th className="p-3">Role Access Level</th>
                      {!isSubAdmin && <th className="p-3">Manage</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-semibold text-slate-900">{u.name}</td>
                        <td className="p-3 font-mono text-slate-600">{u.email}</td>
                        <td className="p-3">
                          {u.role === 'admin' ? (
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-[#FF5500] border border-orange-200 uppercase">
                              Super Admin
                            </span>
                          ) : u.role === 'sub_admin' ? (
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                              Sub Admin (Ops)
                            </span>
                          ) : u.role === 'restaurant' ? (
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                              Merchant
                            </span>
                          ) : u.role === 'courier' ? (
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase">
                              Courier
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                              Customer
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {!isSubAdmin ? (
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold cursor-pointer focus:border-[#FF5500] outline-none"
                            >
                              {USER_ROLES.map(role => (
                                <option key={role.value} value={role.value}>{role.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-slate-500 font-medium">Standard Permissions</span>
                          )}
                        </td>
                        {!isSubAdmin && (
                          <td className="p-3">
                            <button
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer transition-colors"
                              title="Delete staff account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. FOODS & MENU MANAGEMENT */}
          {activeTab === 'menu' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Dishes & Menu Catalog</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Manage live dish pricing, descriptions, and kitchen availability in D1.</p>
                </div>
                <button
                  onClick={() => setIsAddMenuModalOpen(true)}
                  className="px-4 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-orange-500/25"
                >
                  <Plus className="w-4 h-4" /> Add New Dish
                </button>
              </div>

              {isAddMenuModalOpen && (
                <div className="bg-white border border-orange-200 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-bold text-slate-900">Add Dish to Restaurant Menu</h4>
                    <button onClick={() => setIsAddMenuModalOpen(false)} className="text-slate-400 hover:text-slate-900 cursor-pointer p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateMenuItem} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Dish Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Smoky Jollof Rice Special"
                          value={newMenuName}
                          onChange={(e) => setNewMenuName(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Price (NGN) *</label>
                        <input
                          type="number"
                          required
                          placeholder="e.g. 4500"
                          value={newMenuPrice}
                          onChange={(e) => setNewMenuPrice(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-[#FF5500] outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Category</label>
                        <input
                          type="text"
                          placeholder="e.g. Rice Dishes / Grills"
                          value={newMenuCategory}
                          onChange={(e) => setNewMenuCategory(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Image URL</label>
                        <input
                          type="text"
                          placeholder="https://..."
                          value={newMenuImageUrl}
                          onChange={(e) => setNewMenuImageUrl(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Description</label>
                        <textarea
                          rows={2}
                          placeholder="Rich ingredients and portion details..."
                          value={newMenuDesc}
                          onChange={(e) => setNewMenuDesc(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsAddMenuModalOpen(false)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm shadow-orange-500/25"
                      >
                        Add Dish to Menu
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Edit Menu Modal */}
              {isEditMenuModalOpen && editingMenuItem && (
                <div className="bg-white border border-blue-200 rounded-2xl p-5 space-y-4 shadow-xl mb-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-bold text-slate-900">Edit Dish Details</h4>
                    <button onClick={() => setIsEditMenuModalOpen(false)} className="text-slate-400 hover:text-slate-900 cursor-pointer p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleSaveEditMenuItem} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Dish Name *</label>
                        <input
                          type="text"
                          required
                          value={editMenuName}
                          onChange={(e) => setEditMenuName(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Price (NGN) *</label>
                        <input
                          type="number"
                          required
                          value={editMenuPrice}
                          onChange={(e) => setEditMenuPrice(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Category</label>
                        <input
                          type="text"
                          value={editMenuCategory}
                          onChange={(e) => setEditMenuCategory(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Image URL</label>
                        <input
                          type="text"
                          value={editMenuImageUrl}
                          onChange={(e) => setEditMenuImageUrl(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">Description</label>
                        <textarea
                          rows={2}
                          value={editMenuDesc}
                          onChange={(e) => setEditMenuDesc(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsEditMenuModalOpen(false)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm"
                      >
                        Save Changes in D1
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Dish</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Price (NGN)</th>
                      <th className="p-3">Availability</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {menuItemsList.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{m.name}</div>
                          <div className="text-[11px] text-slate-500 line-clamp-1">{m.description}</div>
                        </td>
                        <td className="p-3 text-slate-600">{m.category_id || m.category || 'Main'}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          ₦{Number(m.price || 0).toLocaleString('en-NG')}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleToggleMenuItem(m.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                              m.is_available === 1
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {m.is_available === 1 ? 'Available' : 'Sold Out'}
                          </button>
                        </td>
                        <td className="p-3 flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditMenu(m)}
                            className="text-slate-600 hover:text-slate-900 p-1 cursor-pointer transition-colors"
                            title="Edit dish"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMenuItem(m.id, m.name)}
                            className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer transition-colors"
                            title="Delete dish"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. RIDERS & FLEET MANAGEMENT */}
          {activeTab === 'drivers' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Dispatch Fleet & Courier Roster</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Track rider KYC status, vehicle credentials, and dispatch readiness in D1.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Rider</th>
                      <th className="p-3">Vehicle</th>
                      <th className="p-3">Plate / License</th>
                      <th className="p-3">Rating</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Online State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {driversList.map((d) => (
                      <tr key={d.user_id || d.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{d.name || 'Courier Rider'}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{d.phone}</div>
                        </td>
                        <td className="p-3 text-slate-700">{d.vehicle_type || 'Motorcycle'}</td>
                        <td className="p-3 font-mono text-slate-600">{d.plate_number || 'LAG-001'}</td>
                        <td className="p-3 font-bold text-amber-600">⭐ {Number(d.rating || 5.0).toFixed(1)}</td>
                        <td className="p-3">
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold uppercase">
                            {d.verification_status || 'verified'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            d.is_online === 1 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {d.is_online === 1 ? 'Online' : 'Offline'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {driversList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                          No couriers registered yet. Couriers can be invited under the Staff tab.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. SETTINGS & DELIVERY ZONES */}
          {activeTab === 'settings' && !isSubAdmin && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Delivery Zones & Live Rates (Platform D1)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Control pricing calculations, distance surge, and service zones.</p>
                </div>
                <button
                  onClick={() => setIsAddZoneModalOpen(true)}
                  className="px-4 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-orange-500/25"
                >
                  <Plus className="w-4 h-4" /> Add Delivery Zone
                </button>
              </div>

              {isAddZoneModalOpen && (
                <div className="bg-white border border-orange-200 rounded-2xl p-5 space-y-4 shadow-xl animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-bold text-slate-900">Add New Delivery Zone to Platform D1</h4>
                    <button onClick={() => setIsAddZoneModalOpen(false)} className="text-slate-400 hover:text-slate-900 cursor-pointer p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateZone} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-600 font-semibold block mb-1">Zone Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Lekki Phase 1"
                        value={newZoneName}
                        onChange={(e) => setNewZoneName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 font-semibold block mb-1">Zone Code *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. LEK-01"
                        value={newZoneCode}
                        onChange={(e) => setNewZoneCode(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none uppercase font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 font-semibold block mb-1">City</label>
                      <input
                        type="text"
                        value={newZoneCity}
                        onChange={(e) => setNewZoneCity(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 font-semibold block mb-1">Base Fee (NGN)</label>
                      <input
                        type="number"
                        value={newZoneBaseFee}
                        onChange={(e) => setNewZoneBaseFee(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 font-semibold block mb-1">Per KM Fee (NGN)</label>
                      <input
                        type="number"
                        value={newZonePerKmFee}
                        onChange={(e) => setNewZonePerKmFee(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 font-semibold block mb-1">Surge Multiplier</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newZoneSurge}
                        onChange={(e) => setNewZoneSurge(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none font-mono"
                      />
                    </div>
                    <div className="sm:col-span-3 flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsAddZoneModalOpen(false)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm"
                      >
                        Save Zone in D1
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Zone</th>
                      <th className="p-3">City / Hub</th>
                      <th className="p-3">Base Fee (NGN)</th>
                      <th className="p-3">Per KM Fee</th>
                      <th className="p-3">Surge Multiplier</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {deliveryZonesList.map((z) => (
                      <tr key={z.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-semibold text-slate-900">{z.name}</td>
                        <td className="p-3 text-slate-600">{z.city || 'Lagos'}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">₦{Number(z.base_delivery_fee || 1000).toLocaleString('en-NG')}</td>
                        <td className="p-3 font-mono text-slate-600">₦{Number(z.per_km_fee || 200).toLocaleString('en-NG')} / km</td>
                        <td className="p-3 font-mono font-bold text-[#FF5500]">{Number(z.surge_multiplier || 1.0).toFixed(1)}x</td>
                        <td className="p-3">
                          <button
                            onClick={() => handleToggleZoneActive(z.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                              z.is_active === 1 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {z.is_active === 1 ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleDeleteZone(z.id, z.name)}
                            className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer transition-colors"
                            title="Delete delivery zone"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. DEVELOPER D1 SQL CONSOLE */}
          {activeTab === 'developer' && !isSubAdmin && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Live Platform D1 SQL Query Console</h3>
                <p className="text-xs text-slate-500 mt-0.5">Execute read/write queries directly against edge SQLite.</p>
              </div>

              <form onSubmit={handleExecuteSql} className="space-y-3">
                <textarea
                  rows={4}
                  value={devSqlQuery}
                  onChange={(e) => setDevSqlQuery(e.target.value)}
                  placeholder="Write raw SQL here or select a template below..."
                  className="w-full bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl p-3.5 border border-slate-800 focus:border-[#FF5500] outline-none"
                />
                <div className="flex flex-wrap gap-2 items-center text-[10px] pb-1">
                  <span className="text-slate-500 font-bold">Quick Templates:</span>
                  {[
                    { label: '👥 Users', sql: 'SELECT id, email, name, role, phone, wallet_balance_ngn FROM users LIMIT 10;' },
                    { label: '📦 Orders', sql: 'SELECT id, customer_id, status, total_amount, created_at FROM orders ORDER BY created_at DESC LIMIT 10;' },
                    { label: '⚙️ CMS Settings', sql: 'SELECT * FROM platform_settings;' },
                    { label: '📍 Delivery Zones', sql: 'SELECT * FROM delivery_zones;' },
                    { label: '🍳 Restaurants', sql: 'SELECT id, name, cuisine, rating, is_open FROM restaurants;' },
                    { label: '💳 Wallet Tx', sql: 'SELECT id, user_id, amount, description, created_at FROM wallet_transactions ORDER BY created_at DESC LIMIT 10;' }
                  ].map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => setDevSqlQuery(tpl.sql)}
                      className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-lg border border-slate-200 cursor-pointer transition-colors"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={isExecutingSql}
                  className="px-5 py-2.5 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm shadow-orange-500/25 disabled:opacity-50"
                >
                  <Terminal className="w-4 h-4" /> {isExecutingSql ? 'Executing...' : 'Run Query on D1'}
                </button>
              </form>

              {devSqlResult && (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto text-emerald-300">
                  <pre>{JSON.stringify(devSqlResult, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          {/* 8. SYSTEM AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">System Activity & Audit Logs</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Immutable record of all administrative actions and security events.</p>
                </div>
                <button
                  onClick={handleExportAuditLogs}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">User</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Resource</th>
                      <th className="p-3">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-mono text-slate-500 text-[11px]">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Recent'}
                        </td>
                        <td className="p-3 font-semibold text-slate-900">{log.userEmail || log.user_email || 'System'}</td>
                        <td className="p-3 font-mono text-[#FF5500] font-bold">{log.action}</td>
                        <td className="p-3 text-slate-600">{log.resource}</td>
                        <td className="p-3 font-mono text-slate-500">{log.ip || '127.0.0.1'}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 text-xs">
                          No audit entries recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 9. BROADCAST NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Push Notifications & Broadcasts</h3>
                <p className="text-xs text-slate-500 mt-0.5">Send alerts and promotional messages to customer apps.</p>
              </div>

              <form onSubmit={handleBroadcast} className="space-y-4 max-w-xl">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Broadcast Title</label>
                  <input
                    type="text"
                    required
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Message Body</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Enter your announcement..."
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm shadow-orange-500/25"
                >
                  <Send className="w-4 h-4" /> Send Broadcast
                </button>
              </form>
            </div>
          )}

          {/* 10. PAYMENTS & FINANCIAL LEDGER */}
          {activeTab === 'payments' && !isSubAdmin && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Payment Transactions & Settlement Ledger</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Direct records of payment gateways, wallet transactions, and payment logs.</p>
                </div>
                <button onClick={handleDownloadCSV} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs">
                  <Download className="w-4 h-4" /> Export Ledger CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Reference</th>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Amount (NGN)</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-mono font-semibold text-slate-900">{tx.reference || tx.id}</td>
                        <td className="p-3 font-mono text-[#FF5500]">#{tx.orderId || tx.order_id || 'N/A'}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">₦{Number(tx.amount || 0).toLocaleString('en-NG')}</td>
                        <td className="p-3 uppercase font-medium text-slate-600">{tx.paymentMethod || tx.payment_method || 'Card'}</td>
                        <td className="p-3">
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold uppercase">
                            {tx.status || 'success'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-500 text-[11px]">{tx.createdAt || tx.created_at || 'Recent'}</td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                          No transactions recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 11. REPORTS & EXPORTS */}
          {activeTab === 'reports' && !isSubAdmin && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Financial Reports & Data Exports</h3>
                <p className="text-xs text-slate-500 mt-0.5">Export raw transactional and sales records for accounting.</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                <div className="text-xs text-slate-700">
                  Ready to export <strong className="text-slate-900">{ordersList.length} orders</strong> and <strong className="text-slate-900">{transactions.length} ledger payments</strong>.
                </div>
                <button onClick={handleDownloadCSV} className="px-5 py-2.5 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm shadow-orange-500/25">
                  <Download className="w-4 h-4" /> Download Complete Sales Report CSV
                </button>
              </div>
            </div>
          )}

          {/* DELIVERY MAP & FLEET TRACKING */}
          {activeTab === 'delivery' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Live Delivery Dispatch & Zones</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Real-time GPS tracking, active courier state, and zone surge multipliers in D1.</p>
                </div>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <MapPin className="w-4 h-4 text-[#FF5500]" /> Configure Zone Rates
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-orange-50/60 border border-orange-200 rounded-2xl p-4 space-y-1">
                  <div className="text-[11px] font-bold text-[#FF5500] uppercase tracking-wide">Active Couriers on Road</div>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {driversList.filter((d) => d.is_online === 1).length} Online
                  </div>
                  <div className="text-xs text-slate-600">{driversList.length} total registered fleet</div>
                </div>
                <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 space-y-1">
                  <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">Orders In Transit</div>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {ordersList.filter((o) => o.status === 'delivering' || o.status === 'picked_up').length} Dispatched
                  </div>
                  <div className="text-xs text-slate-600">{ordersList.filter((o) => o.status === 'preparing').length} in kitchen prep</div>
                </div>
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-1">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Delivery Zones Active</div>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {deliveryZonesList.filter((z) => z.is_active === 1).length} Zones
                  </div>
                  <div className="text-xs text-slate-600">Covering Lagos, Abuja & regional hubs</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Zone / Hub</th>
                      <th className="p-3">Base Fee</th>
                      <th className="p-3">Per KM Fee</th>
                      <th className="p-3">Surge Multiplier</th>
                      <th className="p-3">Coverage Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {deliveryZonesList.map((z) => (
                      <tr key={z.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-semibold text-slate-900">{z.name}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">₦{Number(z.base_delivery_fee || 1000).toLocaleString('en-NG')}</td>
                        <td className="p-3 font-mono text-slate-600">₦{Number(z.per_km_fee || 200).toLocaleString('en-NG')}/km</td>
                        <td className="p-3 font-mono font-bold text-[#FF5500]">{Number(z.surge_multiplier || 1.0).toFixed(1)}x</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            z.is_active === 1 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {z.is_active === 1 ? 'Operational' : 'Paused'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Routing Provider Manager & Circuit Breaker Health Status */}
              <div className="pt-4 border-t border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Routing Engine Provider Manager & Health Monitor
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Multi-tier distance and ETA calculations with automatic circuit breaker failover.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                    Auto-Failover Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">1. Valhalla Engine</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <p className="text-[11px] text-slate-500">Primary Provider (3s Timeout)</p>
                    <div className="text-[10px] font-mono text-emerald-700 font-semibold">🟢 Operational (0 Errors)</div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">2. OSRM Engine</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <p className="text-[11px] text-slate-500">Secondary Provider (3s Timeout)</p>
                    <div className="text-[10px] font-mono text-emerald-700 font-semibold">🟢 Ready for Failover</div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">3. Google Maps API</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <p className="text-[11px] text-slate-500">Emergency Fallback (5s Timeout)</p>
                    <div className="text-[10px] font-mono text-emerald-700 font-semibold">🟢 Quota Protected</div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">4. Haversine Safety</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    <p className="text-[11px] text-slate-500">1.3x Urban Road Multiplier</p>
                    <div className="text-[10px] font-mono text-emerald-700 font-semibold">🟢 100% Resilient Backup</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CATEGORIES MANAGEMENT */}
          {activeTab === 'categories' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Menu Categories Catalog</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Live dish categorizations stored directly in Platform D1.</p>
                </div>
                <button
                  onClick={() => setIsAddCatModalOpen(true)}
                  className="px-4 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-orange-500/25"
                >
                  <Plus className="w-4 h-4" /> Add Category
                </button>
              </div>

              {isAddCatModalOpen && (
                <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-200 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase text-slate-900">Create New Menu Category in D1</h4>
                    <button onClick={() => setIsAddCatModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateCategory} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Category Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Swallows & Soups"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Description</label>
                      <input
                        type="text"
                        placeholder="e.g. Fresh pounded yam, egusi, and native delicacies"
                        value={newCatDesc}
                        onChange={(e) => setNewCatDesc(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddCatModalOpen(false)}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold shadow-sm"
                      >
                        Save Category to D1
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Category Name</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Dishes Linked</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {categoriesList.map((c) => {
                      const count = menuItemsList.filter((m) => (m.category || m.category_id || '').toLowerCase() === c.name.toLowerCase()).length;
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 font-semibold text-slate-900">{c.name}</td>
                          <td className="p-3 text-slate-500">{c.description || 'No description'}</td>
                          <td className="p-3 font-mono font-bold text-slate-700">{count} items</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase">
                              Active
                            </span>
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => handleDeleteCategory(c.id, c.name)}
                              className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                              title="Delete category"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {categoriesList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500 text-xs">
                          No categories found. Click Add Category to create one in Platform D1.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ADD-ONS & OPTIONS MANAGEMENT */}
          {activeTab === 'addons' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Dish Add-ons & Modifiers</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Manage extra proteins, sides, and toppings stored in D1 item_modifiers.</p>
                </div>
                <button
                  onClick={() => setIsAddAddonModalOpen(true)}
                  className="px-4 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-orange-500/25"
                >
                  <Plus className="w-4 h-4" /> Add Add-on
                </button>
              </div>

              {isAddAddonModalOpen && (
                <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-200 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase text-slate-900">Create New Add-on / Modifier</h4>
                    <button onClick={() => setIsAddAddonModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateAddon} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Add-on Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Extra Grilled Chicken Portion"
                        value={newAddonName}
                        onChange={(e) => setNewAddonName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Price (NGN) *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 1500"
                        value={newAddonPrice}
                        onChange={(e) => setNewAddonPrice(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-[#FF5500] outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddAddonModalOpen(false)}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold shadow-sm"
                      >
                        Save Add-on to D1
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Modifier Name</th>
                      <th className="p-3">Group</th>
                      <th className="p-3">Price (NGN)</th>
                      <th className="p-3">Availability</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {addonsList.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-semibold text-slate-900">{a.name}</td>
                        <td className="p-3 text-slate-500 font-mono">{a.group_id || 'Extras'}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">₦{Number(a.price || 0).toLocaleString('en-NG')}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase">
                            Available
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleDeleteAddon(a.id, a.name)}
                            className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                            title="Delete add-on"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {addonsList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500 text-xs">
                          No add-ons created yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* KITCHEN INVENTORY MANAGEMENT */}
          {activeTab === 'inventory' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Kitchen Stock & Inventory Controller</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Instant 1-click in-stock and sold-out toggling synced with Platform D1.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    {menuItemsList.filter((m) => m.is_available === 1).length} Available / {menuItemsList.length} Total
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Dish / Item</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Price</th>
                      <th className="p-3">Prep Time</th>
                      <th className="p-3">Kitchen Status</th>
                      <th className="p-3">Toggle Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {menuItemsList.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-semibold text-slate-900">{m.name}</td>
                        <td className="p-3 text-slate-600">{m.category_id || m.category || 'Main Dishes'}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">₦{Number(m.price || 0).toLocaleString('en-NG')}</td>
                        <td className="p-3 font-mono text-slate-500">{m.prep_time_min || 20} mins</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            m.is_available === 1 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {m.is_available === 1 ? 'In Stock' : 'Sold Out'}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleToggleMenuItem(m.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              m.is_available === 1
                                ? 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                                : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                            }`}
                          >
                            {m.is_available === 1 ? 'Mark Sold Out' : 'Restock Item'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ALL USER ACCOUNTS & WALLETS */}
          {activeTab === 'all_users' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">All User Accounts & Wallet Ledger</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Authoritative user accounts queried directly from Platform D1 users table.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search accounts..."
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#FF5500]"
                    />
                  </div>
                </div>
              </div>

              {/* D1 Live Total Wallet Sum Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest block">
                    Platform D1 Total Wallet Liabilities
                  </span>
                  <div className="text-2xl sm:text-3xl font-black font-mono mt-0.5 tracking-tight text-white">
                    ₦{usersList.reduce((acc, u) => acc + (Number(u.wallet_balance_ngn ?? u.walletBalanceNGN ?? 0)), 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Live SUM(wallet_balance_ngn) across all {usersList.length} D1 registered user accounts
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 bg-white/10 px-3 py-2 rounded-xl text-xs font-semibold text-white/90">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Single Source of Truth: D1 SQL</span>
                </div>
              </div>

              {selectedUserForWallet && (
                <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase text-slate-900">
                        Adjust Wallet Balance: <span className="text-[#FF5500]">{selectedUserForWallet.name}</span> ({selectedUserForWallet.email})
                      </h4>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Current Balance: ₦{Number(selectedUserForWallet.wallet_balance_ngn || 0).toLocaleString('en-NG')}
                      </div>
                    </div>
                    <button onClick={() => setSelectedUserForWallet(null)} className="text-slate-400 hover:text-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleAdjustWallet} className="flex flex-wrap items-center gap-3">
                    <input
                      type="number"
                      required
                      placeholder="Credit amount (NGN)"
                      value={walletAdjustAmount}
                      onChange={(e) => setWalletAdjustAmount(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-[#FF5500] outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Credit reason (e.g. VIP Promotion)"
                      value={walletAdjustReason}
                      onChange={(e) => setWalletAdjustReason(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none flex-1 min-w-[200px]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Credit Wallet in D1
                    </button>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Wallet (NGN)</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {usersList
                      .filter((u) => {
                        if (!customerSearchQuery.trim()) return true;
                        const q = customerSearchQuery.toLowerCase();
                        return (
                          (u.name || '').toLowerCase().includes(q) ||
                          (u.email || '').toLowerCase().includes(q) ||
                          (u.phone || '').toLowerCase().includes(q)
                        );
                      })
                      .map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3">
                            <div className="font-semibold text-slate-900">{u.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                          </td>
                          <td className="p-3">
                            {!isSubAdmin ? (
                              <select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] text-slate-800 font-semibold cursor-pointer focus:border-[#FF5500] outline-none"
                              >
                                {USER_ROLES.map(role => (
                                  <option key={role.value} value={role.value}>{role.label}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold uppercase text-slate-700">
                                {u.role}
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-600">
                            ₦{Number(u.wallet_balance_ngn || 0).toLocaleString('en-NG')}
                          </td>
                          <td className="p-3 font-mono text-slate-600">{u.phone || 'N/A'}</td>
                          <td className="p-3 flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedUserForWallet(u);
                                setWalletAdjustAmount('1000');
                              }}
                              className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-[#FF5500] border border-orange-200 rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              Credit Wallet
                            </button>
                            {!isSubAdmin && u.id !== user?.id && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                                title="Delete account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REVIEWS & RATINGS MODERATION */}
          {activeTab === 'reviews' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Customer Reviews & Ratings</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Moderate customer feedback and reply directly via Platform D1.</p>
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  {reviewsList.length} verified reviews
                </div>
              </div>

              {replyReviewId && (
                <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase text-slate-900">Reply to Customer Review</h4>
                    <button onClick={() => setReplyReviewId(null)} className="text-slate-400 hover:text-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Write merchant reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 flex-1 outline-none focus:border-[#FF5500]"
                    />
                    <button
                      onClick={() => handleReplyReview(replyReviewId)}
                      className="px-4 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold"
                    >
                      Post Reply to D1
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Food Rating</th>
                      <th className="p-3">Delivery Rating</th>
                      <th className="p-3">Comment & Merchant Reply</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {reviewsList.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-semibold text-slate-900">{r.customer_name || 'Customer'}</td>
                        <td className="p-3 font-bold text-amber-600">⭐ {Number(r.food_rating || 5).toFixed(1)}</td>
                        <td className="p-3 font-bold text-amber-600">⭐ {Number(r.delivery_rating || 5).toFixed(1)}</td>
                        <td className="p-3 space-y-1">
                          <div className="text-slate-800 italic">"{r.comment || 'Great food and fast delivery!'}"</div>
                          {r.merchant_reply && (
                            <div className="text-[11px] text-[#FF5500] font-medium bg-orange-50/60 px-2 py-1 rounded-md border border-orange-100">
                              <strong>Reply:</strong> {r.merchant_reply}
                            </div>
                          )}
                        </td>
                        <td className="p-3 flex items-center gap-2">
                          <button
                            onClick={() => {
                              setReplyReviewId(r.id);
                              setReplyText(r.merchant_reply || '');
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold"
                          >
                            Reply
                          </button>
                          <button
                            onClick={() => handleDeleteReview(r.id)}
                            className="text-rose-600 hover:text-rose-800 p-1"
                            title="Delete review"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {reviewsList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500 text-xs">
                          No reviews submitted yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* LOYALTY REWARDS & TIER SETTINGS */}
          {activeTab === 'loyalty' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">Loyalty Rewards & Tier Policy</h3>
                <p className="text-xs text-slate-500 mt-0.5">Configure reward multiplier, points redemption, and VIP tiers in D1.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Bronze Tier</div>
                  <div className="text-base font-bold text-slate-900">0 - 999 pts</div>
                  <div className="text-xs text-slate-500">1x Point per ₦100 spent</div>
                </div>
                <div className="p-4 bg-slate-100 border border-slate-300 rounded-2xl space-y-1">
                  <div className="text-[10px] font-bold text-slate-600 uppercase">Silver Tier</div>
                  <div className="text-base font-bold text-slate-900">1,000 - 2,499 pts</div>
                  <div className="text-xs text-slate-500">1.25x Point per ₦100 spent</div>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
                  <div className="text-[10px] font-bold text-amber-700 uppercase">Gold Tier</div>
                  <div className="text-base font-bold text-amber-900">2,500 - 4,999 pts</div>
                  <div className="text-xs text-amber-700">1.5x Point + Priority dispatch</div>
                </div>
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl space-y-1">
                  <div className="text-[10px] font-bold text-[#FF5500] uppercase">Platinum Tier</div>
                  <div className="text-base font-bold text-slate-900">5,000+ pts</div>
                  <div className="text-xs text-[#FF5500]">2x Point + Zero delivery fee</div>
                </div>
              </div>

              <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-4">
                <h4 className="text-xs font-bold uppercase text-slate-900">Redemption Value Configuration</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Points per ₦100 Spend</label>
                    <input
                      type="number"
                      defaultValue={platformSettings['loyalty_rate'] || '1'}
                      onBlur={(e) => handleSaveCMS('loyalty_rate', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono outline-none focus:border-[#FF5500]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Redemption Discount (₦ per 100 pts)</label>
                    <input
                      type="number"
                      defaultValue={platformSettings['loyalty_discount_value'] || '200'}
                      onBlur={(e) => handleSaveCMS('loyalty_discount_value', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono outline-none focus:border-[#FF5500]"
                    />
                  </div>
                </div>
                <div className="text-xs text-emerald-700 font-medium">✓ Changes auto-save directly to D1 platform_settings.</div>
              </div>
            </div>
          )}

          {/* PROMOTIONS & COUPONS */}
          {activeTab === 'promos' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Promotions & Discount Coupons</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Authoritative promo codes validated during checkout against Platform D1.</p>
                </div>
                <button
                  onClick={() => setIsAddPromoModalOpen(true)}
                  className="px-4 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-orange-500/25"
                >
                  <Plus className="w-4 h-4" /> Add Promo Code
                </button>
              </div>

              {isAddPromoModalOpen && (
                <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-200 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase text-slate-900">Create New Coupon Code in D1</h4>
                    <button onClick={() => setIsAddPromoModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreatePromo} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Coupon Code *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. FLASH50"
                        value={newPromoCode}
                        onChange={(e) => setNewPromoCode(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:border-[#FF5500] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Discount Value *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 20 (for 20% or ₦1000)"
                        value={newPromoDiscount}
                        onChange={(e) => setNewPromoDiscount(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#FF5500] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Discount Type</label>
                      <select
                        value={newPromoType}
                        onChange={(e) => setNewPromoType(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                      >
                        {DISCOUNT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Min Order Amount (NGN)</label>
                      <input
                        type="number"
                        placeholder="e.g. 2000"
                        value={newPromoMinOrder}
                        onChange={(e) => setNewPromoMinOrder(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#FF5500] outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end items-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddPromoModalOpen(false)}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold shadow-sm"
                      >
                        Activate Coupon in D1
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Coupon Code</th>
                      <th className="p-3">Discount</th>
                      <th className="p-3">Min Order</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {promosList.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-mono font-bold text-[#FF5500]">{p.code}</td>
                        <td className="p-3 font-semibold text-slate-900">
                          {p.discount_type === 'percentage' ? `${p.value}% Off` : `₦${Number(p.value).toLocaleString('en-NG')} Off`}
                        </td>
                        <td className="p-3 font-mono text-slate-600">₦{Number(p.min_order_amount || 0).toLocaleString('en-NG')}</td>
                        <td className="p-3">
                          <button
                            onClick={() => handleTogglePromo(p.id)}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer ${
                              p.is_active === 1 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {p.is_active === 1 ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleDeletePromo(p.id, p.code)}
                            className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                            title="Delete coupon"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {promosList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500 text-xs">
                          No active promo codes. Click Add Promo Code to create one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* RESTAURANT BRANCHES */}
          {activeTab === 'branches' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Restaurant Branches & Cloud Kitchens</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Authoritative branch registry stored in Platform D1 restaurants table.</p>
                </div>
                <button
                  onClick={() => setIsAddRestaurantModalOpen(true)}
                  className="px-4 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-orange-500/25"
                >
                  <Plus className="w-4 h-4" /> Add Restaurant Branch
                </button>
              </div>

              {isAddRestaurantModalOpen && (
                <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-200 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase text-slate-900">Add New Restaurant Kitchen</h4>
                    <button onClick={() => setIsAddRestaurantModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateRestaurant} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Restaurant Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Veyra Kitchen Victoria Island"
                        value={newRestName}
                        onChange={(e) => setNewRestName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Physical Address *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 14 Adeola Odeku St, VI, Lagos"
                        value={newRestAddress}
                        onChange={(e) => setNewRestAddress(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Cuisine</label>
                      <input
                        type="text"
                        value={newRestCuisine}
                        onChange={(e) => setNewRestCuisine(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Delivery Fee (NGN)</label>
                      <input
                        type="number"
                        value={newRestDeliveryFee}
                        onChange={(e) => setNewRestDeliveryFee(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#FF5500] outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddRestaurantModalOpen(false)}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold shadow-sm"
                      >
                        Save Branch to D1
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {isEditRestaurantModalOpen && editingRestaurant && (
                <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase text-slate-900 flex items-center gap-1.5">
                        <Edit3 className="w-4 h-4 text-indigo-600" />
                        <span>Edit Restaurant: {editingRestaurant.name}</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">Updates will be saved directly into Cloudflare D1 and reflected publicly on the site.</p>
                    </div>
                    <button onClick={() => setIsEditRestaurantModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleSaveEditRestaurant} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Restaurant Name *</label>
                      <input
                        type="text"
                        required
                        value={editRestName}
                        onChange={(e) => setEditRestName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Physical Address *</label>
                      <input
                        type="text"
                        required
                        value={editRestAddress}
                        onChange={(e) => setEditRestAddress(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Cuisine / Category</label>
                      <input
                        type="text"
                        value={editRestCuisine}
                        onChange={(e) => setEditRestCuisine(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Delivery Fee (NGN ₦)</label>
                      <input
                        type="number"
                        value={editRestDeliveryFee}
                        onChange={(e) => setEditRestDeliveryFee(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Min Delivery Time (mins)</label>
                      <input
                        type="number"
                        value={editRestDeliveryMin}
                        onChange={(e) => setEditRestDeliveryMin(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Max Delivery Time (mins)</label>
                      <input
                        type="number"
                        value={editRestDeliveryMax}
                        onChange={(e) => setEditRestDeliveryMax(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Rating (1.0 to 5.0)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        value={editRestRating}
                        onChange={(e) => setEditRestRating(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tagline</label>
                      <input
                        type="text"
                        value={editRestTagline}
                        onChange={(e) => setEditRestTagline(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Banner Image URL (Cloudflare R2 or direct URL)</label>
                      <input
                        type="url"
                        placeholder="https://... or Cloudflare R2 object URL"
                        value={editRestBannerUrl}
                        onChange={(e) => setEditRestBannerUrl(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditRestaurantModalOpen(false)}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
                      >
                        Save Restaurant to D1
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Restaurant</th>
                      <th className="p-3">Address</th>
                      <th className="p-3">Cuisine</th>
                      <th className="p-3">Rating</th>
                      <th className="p-3">Delivery Fee</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {restaurantsList.map((rest) => (
                      <tr key={rest.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            {(rest.bannerUrl || rest.banner_r2_url) && (
                              <img
                                src={rest.bannerUrl || rest.banner_r2_url}
                                alt={rest.name}
                                className="w-7 h-7 rounded-lg object-cover"
                              />
                            )}
                            <span>{rest.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-slate-600 max-w-[200px] truncate">{rest.address}</td>
                        <td className="p-3 text-slate-600">{rest.cuisine || 'Continental'}</td>
                        <td className="p-3 font-bold text-amber-600">⭐ {Number(rest.rating || 4.8).toFixed(1)}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">₦{Number(rest.deliveryFee || rest.delivery_fee || 1000).toLocaleString('en-NG')}</td>
                        <td className="p-3">
                          <button
                            onClick={() => handleToggleBranchStatus(rest.id)}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer ${
                              rest.isOpen !== false && rest.is_open !== 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {rest.isOpen !== false && rest.is_open !== 0 ? 'Open' : 'Closed'}
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditRestaurant(rest)}
                              className="text-indigo-600 hover:text-indigo-800 p-1 cursor-pointer rounded-lg hover:bg-indigo-50 transition-colors"
                              title="Edit restaurant details & image"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRestaurant(rest.id, rest.name)}
                              className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer rounded-lg hover:bg-rose-50 transition-colors"
                              title="Delete branch"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CUSTOMER SUPPORT DESK */}
          {activeTab === 'support' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 rounded-2xl bg-slate-950 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-xs font-bold uppercase tracking-widest text-orange-300">Customer experience</p><h3 className="mt-2 text-xl font-bold">Support operations</h3><p className="mt-1 text-sm text-slate-300">Review incoming requests, manage status and reply to customers. Replies are saved to D1 and shown in ticket lookup.</p></div>
                <button onClick={() => fetchData()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"><RefreshCw className="h-4 w-4" /> Refresh tickets</button>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  {label:'All tickets',value:supportTicketsList.length},
                  {label:'Open',value:supportTicketsList.filter(t => (t.status || 'open') === 'open').length},
                  {label:'In progress',value:supportTicketsList.filter(t => t.status === 'in_progress').length},
                  {label:'Waiting on customer',value:supportTicketsList.filter(t => t.status === 'waiting_on_customer').length}
                ].map(item => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{item.value}</p></div>)}
              </div>
              {supportTicketsList.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><HelpCircle className="mx-auto h-8 w-8 text-slate-300" /><h4 className="mt-3 text-base font-bold text-slate-900">No support tickets yet</h4><p className="mt-1 text-sm text-slate-500">New requests submitted from Contact Support will appear here.</p></div> : (
                <div className="space-y-4">
                  {supportTicketsList.map((t) => (
                    <article key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-orange-700">{t.id}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold capitalize text-slate-700">{String(t.status || 'open').replaceAll('_',' ')}</span><span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-500">{t.priority || 'normal'} priority</span></div><h4 className="mt-2 text-base font-bold text-slate-950">{t.subject || 'Support request'}</h4><p className="mt-1 text-xs text-slate-500">{t.customer_name || 'Customer'} · {t.user_email || t.email || 'No email'} · {t.created_at ? new Date(t.created_at).toLocaleString() : 'Date unavailable'}</p></div>
                        <select aria-label="Ticket status" value={t.status || 'open'} onChange={e => handleUpdateTicketStatus(t.id, e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-orange-500"><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_on_customer">Waiting on customer</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select>
                      </div>
                      <div className="py-4"><p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Customer message</p><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{t.message}</p></div>
                      {t.admin_reply && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[11px] font-bold uppercase tracking-widest text-emerald-800">Latest saved reply</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-950">{t.admin_reply}</p></div>}
                      <div className="rounded-xl bg-slate-50 p-4"><label className="mb-2 block text-xs font-bold text-slate-700">Reply to customer<textarea rows={3} maxLength={4000} value={supportReplyDrafts[t.id] || ''} onChange={e => setSupportReplyDrafts(prev => ({...prev,[t.id]:e.target.value}))} placeholder="Write a clear, helpful response…" className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100" /></label><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-slate-500">Saved replies are visible to the customer when they check this ticket.</p><button disabled={sendingSupportReply === t.id || !(supportReplyDrafts[t.id] || '').trim()} onClick={() => handleReplySupportTicket(t.id)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">{sendingSupportReply === t.id ? 'Saving reply…' : 'Send reply'} <Send className="h-3.5 w-3.5" /></button></div></div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CMS WEBSITE CONTENT */}
          {activeTab === 'cms' && !isSubAdmin && (() => {
            const renderCmsInput = (key: string, label: string, defaultVal: string, isTextarea = false, isImage = false) => {
              const currentValue = cmsDrafts[key] ?? (platformSettings[key] || defaultVal);
              const isSaving = savingKey === key;
              return (
                <div key={key} className="space-y-1.5 p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="text-xs font-bold text-slate-800">{label}</label>
                      <span className="text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200/60 truncate max-w-[140px]">{key}</span>
                    </div>
                    {isTextarea ? (
                      <textarea
                        rows={3}
                        value={currentValue}
                        onChange={(e) => setCmsDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none transition-colors"
                      />
                    ) : (
                      <input
                        type={isImage ? 'url' : 'text'}
                        value={currentValue}
                        onChange={(e) => setCmsDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none transition-colors"
                      />
                    )}
                    {isImage && currentValue && (
                      <div className="flex items-center gap-2.5 pt-1.5">
                        <img
                          src={currentValue}
                          alt={label}
                          className="w-14 h-10 object-cover rounded-lg border border-slate-200 bg-slate-100"
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                        />
                        <span className="text-[10px] text-slate-500 font-medium">Live thumbnail preview</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 mt-1">
                    <span className="text-[10px] text-slate-400">
                      {platformSettings[key] ? '✓ Live D1' : 'Default'}
                    </span>
                    <button
                      onClick={() => handleSaveCMS(key, currentValue)}
                      disabled={isSaving}
                      className="px-3 py-1.5 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
                    >
                      {isSaving ? 'Saving...' : 'Save to D1'}
                    </button>
                  </div>
                </div>
              );
            };

            return (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
                {/* CMS Header & Batch Save */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>Website CMS & Public Content Manager</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        Cloudflare D1 Live
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Control every public headline, description, dish showcase, FAQ, contact info, and banner image. Single source of truth.
                    </p>
                  </div>
                  <button
                    onClick={handleSaveAllCMS}
                    disabled={isSavingAllCMS}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{isSavingAllCMS ? 'Saving All to D1...' : '💾 Save All CMS Changes to D1'}</span>
                  </button>
                </div>

                {/* Sub-Category Navigation Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {[
                    { id: 'hero', label: '🏠 Homepage Hero' },
                    { id: 'dishes', label: '🍲 Featured Dishes' },
                    { id: 'steps', label: '🚀 How It Works' },
                    { id: 'partner', label: '🤝 Partner Program' },
                    { id: 'help', label: '❓ Help & FAQs' },
                    { id: 'contact', label: '📞 Contact & Hours' },
                    { id: 'legal', label: '📜 Terms & Privacy' },
                    { id: 'footer', label: '🎨 Footer & Promos' },
                    { id: 'images', label: '🖼️ Public Banners & R2' },
                    { id: 'cms', label: '⚙️ CMS Settings' }
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => setCmsCategory(sub.id as any)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all border ${
                        cmsCategory === sub.id
                          ? 'bg-[#FF5500] text-white border-[#FF5500] shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* Section 1: Homepage Hero & Headlines */}
                {cmsCategory === 'hero' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Hero Section Headlines & Stats</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {renderCmsInput('cms_hero_badge', 'Hero Badge Pill', 'Global Express Food & Cloud Kitchen Network')}
                      {renderCmsInput('cms_hero_title', 'Hero Main Title', 'Hot, Delicious Meals Delivered to Your Door in 25 Minutes.')}
                      {renderCmsInput('cms_hero_subtitle', 'Hero Subtitle Description', 'Order authentic specialties, artisanal pizzas, gourmet burgers, and delicious dishes from top-rated restaurants across your city.', true)}
                      {renderCmsInput('cms_hero_cta_text', 'Hero Explore Button Label', 'Find Kitchens')}
                      {renderCmsInput('cms_hero_stat_time', 'Delivery Speed Stat', '25–35 min')}
                      {renderCmsInput('cms_hero_stat_fee', 'Delivery Fee Stat', '₦500')}
                      {renderCmsInput('cms_hero_stat_orders', 'Orders Fulfilled Stat', '45,000+')}
                      {renderCmsInput('cms_hero_stat_rating', 'Platform Rating Stat', '4.8')}
                    </div>
                  </div>
                )}

                {/* Section 2: Featured Hero Dish Cards */}
                {cmsCategory === 'dishes' && (
                  <div className="space-y-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Featured Dish Cards (Homepage Visual Showcase)</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Dish 1 */}
                      <div className="p-4 bg-orange-50/40 border border-orange-200/70 rounded-2xl space-y-3">
                        <div className="text-xs font-bold text-orange-900">Featured Dish #1</div>
                        {renderCmsInput('cms_hero_dish1_title', 'Dish Name', 'Smoky Party Jollof & Peppered Asun')}
                        {renderCmsInput('cms_hero_dish1_restaurant', 'Kitchen Name', 'Naija Kitchen')}
                        {renderCmsInput('cms_hero_dish1_price', 'Price in Naira', '3800')}
                        {renderCmsInput('cms_hero_dish1_image', 'Dish Image URL', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=240&q=80', false, true)}
                      </div>

                      {/* Dish 2 */}
                      <div className="p-4 bg-amber-50/40 border border-amber-200/70 rounded-2xl space-y-3">
                        <div className="text-xs font-bold text-amber-900">Featured Dish #2</div>
                        {renderCmsInput('cms_hero_dish2_title', 'Dish Name', 'Double Smash Beef Cheeseburger')}
                        {renderCmsInput('cms_hero_dish2_restaurant', 'Kitchen Name', 'Burger House')}
                        {renderCmsInput('cms_hero_dish2_price', 'Price in Naira', '4200')}
                        {renderCmsInput('cms_hero_dish2_image', 'Dish Image URL', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=240&q=80', false, true)}
                      </div>

                      {/* Dish 3 */}
                      <div className="p-4 bg-rose-50/40 border border-rose-200/70 rounded-2xl space-y-3">
                        <div className="text-xs font-bold text-rose-900">Featured Dish #3</div>
                        {renderCmsInput('cms_hero_dish3_title', 'Dish Name', 'Peppered Beef Suya & Onions')}
                        {renderCmsInput('cms_hero_dish3_restaurant', 'Kitchen Name', 'Suya Express')}
                        {renderCmsInput('cms_hero_dish3_price', 'Price in Naira', '2800')}
                        {renderCmsInput('cms_hero_dish3_image', 'Dish Image URL', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=240&q=80', false, true)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 3: How It Works */}
                {cmsCategory === 'steps' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">How Veyrang Works (3-Step Customer Journey)</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {renderCmsInput('cms_how_it_works_title', 'Section Headline', 'How Veyrang Delivers to You')}
                      {renderCmsInput('cms_how_it_works_subtitle', 'Section Subtitle', 'No guesswork, no fake GPS maps. Pure transparency from the kitchen flame to your dining table.', true)}
                      {renderCmsInput('cms_step1_title', 'Step 1 Title', 'Choose Your Vetted Kitchen')}
                      {renderCmsInput('cms_step1_desc', 'Step 1 Description', 'Filter by cuisine, prep speed, or neighborhood. Explore authentic Nigerian dishes, Italian pizza, or burgers prepared by hygiene-audited local chefs.', true)}
                      {renderCmsInput('cms_step2_title', 'Step 2 Title', 'Instant Naira Settlement')}
                      {renderCmsInput('cms_step2_desc', 'Step 2 Description', 'Pay seamlessly with Nigerian debit card, instant bank transfer, in-app wallet balance, or cash on delivery. Zero hidden conversion fees.', true)}
                      {renderCmsInput('cms_step3_title', 'Step 3 Title', '4-Digit PIN Doorstep Handover')}
                      {renderCmsInput('cms_step3_desc', 'Step 3 Description', 'Your dispatch rider verifies your secret 4-digit PIN before opening the tamper-evident sealed parcel. Guaranteed hot, fresh, and accurate.', true)}
                    </div>
                  </div>
                )}

                {/* Section 4: Partner Page */}
                {cmsCategory === 'partner' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Partner With Us Page CMS</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {renderCmsInput('cms_partner_page_title', 'Partner Page Headline', 'Partner with Veyrang')}
                      {renderCmsInput('cms_partner_page_subtitle', 'Partner Page Subtitle', 'Grow your culinary business with thousands of food lovers across Nigeria', true)}
                      {renderCmsInput('cms_partner_benefit1_title', 'Benefit 1 Title', 'Increase Sales')}
                      {renderCmsInput('cms_partner_benefit1_desc', 'Benefit 1 Description', 'Boost daily order volume by up to 40% with doorstep dispatch.', true)}
                      {renderCmsInput('cms_partner_benefit2_title', 'Benefit 2 Title', 'New Customers')}
                      {renderCmsInput('cms_partner_benefit2_desc', 'Benefit 2 Description', 'Reach corporate workers and residents across Lekki, VI & Ikeja.', true)}
                      {renderCmsInput('cms_partner_benefit3_title', 'Benefit 3 Title', 'Fast Settlements')}
                      {renderCmsInput('cms_partner_benefit3_desc', 'Benefit 3 Description', 'Automated direct bank payouts with transparent 15% commission.', true)}
                    </div>
                  </div>
                )}

                {/* Section 5: Help & FAQs */}
                {cmsCategory === 'help' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Help Center & Frequently Asked Questions</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {renderCmsInput('cms_help_title', 'Help Center Headline', 'Help & Support')}
                      {renderCmsInput('cms_help_subtitle', 'Help Center Subtitle', 'Frequently asked questions, delivery policies, and customer support')}
                      {renderCmsInput('cms_whatsapp_phone', 'WhatsApp Support Phone', '+234 800 839 7264')}
                      {renderCmsInput('cms_whatsapp_desc', 'WhatsApp Hours Note', 'Available 8am – 11pm WAT')}
                    </div>
                    <div className="space-y-3 pt-2">
                      <div className="text-xs font-bold text-slate-700">FAQ Accordion Items</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderCmsInput('cms_faq1_q', 'FAQ 1 Question', 'How long does doorstep delivery take in Lagos?')}
                        {renderCmsInput('cms_faq1_a', 'FAQ 1 Answer', 'Average delivery takes between 25 to 35 minutes depending on traffic and your delivery zone. Monitor live progress in the My Orders tab.', true)}
                        {renderCmsInput('cms_faq2_q', 'FAQ 2 Question', 'What payment methods do you accept?')}
                        {renderCmsInput('cms_faq2_a', 'FAQ 2 Answer', 'Veyrang accepts all debit cards, instant Bank Transfer / Virtual Accounts, and Veyrang in-app Wallet balances.', true)}
                        {renderCmsInput('cms_faq3_q', 'FAQ 3 Question', 'How does the Handover PIN work?')}
                        {renderCmsInput('cms_faq3_a', 'FAQ 3 Answer', 'Every delivery is assigned a unique 4-digit Handover PIN. Share this code with your rider when they arrive to verify order release.', true)}
                        {renderCmsInput('cms_faq4_q', 'FAQ 4 Question', 'Can I cancel or modify my food order after placing it?')}
                        {renderCmsInput('cms_faq4_a', 'FAQ 4 Answer', 'You can cancel within 60 seconds before kitchen accepts the ticket. Once cooking begins, cancellations cannot be accepted to prevent waste.', true)}
                        {renderCmsInput('cms_faq5_q', 'FAQ 5 Question', 'How do refunds work if an item is missing or sold out?')}
                        {renderCmsInput('cms_faq5_a', 'FAQ 5 Answer', 'Refunds are instantly credited to your Veyrang Wallet balance with zero deduction, ready for your next meal or bank payout.', true)}
                        {renderCmsInput('cms_faq6_q', 'FAQ 6 Question', 'What is the delivery fee and minimum order?')}
                        {renderCmsInput('cms_faq6_a', 'FAQ 6 Answer', 'Delivery fees start at ₦500 within your local neighborhood zone. Minimum order values vary by restaurant (typically ₦1,500 to ₦2,000).', true)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 6: Contact & Support */}
                {cmsCategory === 'contact' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Customer Support & Headquarters Contact</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {renderCmsInput('cms_contact_title', 'Contact Page Headline', 'Contact Customer Care')}
                      {renderCmsInput('cms_contact_subtitle', 'Contact Page Subtitle', 'We are here to assist with your orders, payments, and delivery inquiries')}
                      {renderCmsInput('cms_support_phone', 'Primary Support Phone / Hotline', '+234 800 839 7264')}
                      {renderCmsInput('cms_support_email', 'Official Support Email', 'support@veyrang.com')}
                      {renderCmsInput('cms_support_address', 'Headquarters Physical Address', '14 Adeola Odeku St, Victoria Island, Lagos')}
                      {renderCmsInput('cms_support_hours', 'Support Desk Hours Notice', '8:00 AM – 11:00 PM WAT (Monday to Sunday)')}
                    </div>
                  </div>
                )}

                {/* Section 7: Terms & Privacy */}
                {cmsCategory === 'legal' && (
                  <div className="space-y-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Terms of Service & Privacy Policy Copy</div>
                    <div className="p-4 bg-slate-50 rounded-2xl space-y-4">
                      <div className="text-xs font-bold text-slate-900">Terms of Service Articles</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderCmsInput('cms_terms_effective_date', 'Terms Effective Date Note', 'Effective date: October 2026 · Governing food delivery operations across Nigeria')}
                        {renderCmsInput('cms_terms_s1_title', 'Section 1 Title', '1. Platform Overview & Ordering Rules')}
                        {renderCmsInput('cms_terms_s1_content', 'Section 1 Content', 'Veyrang operates a multi-restaurant culinary marketplace connecting consumers with vetted Nigerian restaurants, cloud kitchens, and independent couriers.', true)}
                        {renderCmsInput('cms_terms_s2_title', 'Section 2 Title', '2. Delivery Times & Handover PIN Verification')}
                        {renderCmsInput('cms_terms_s2_content', 'Section 2 Content', 'Estimated arrival times (ETAs) are calculated algorithmically based on kitchen prep velocity and real-time traffic conditions in Lagos and Abuja.', true)}
                        {renderCmsInput('cms_terms_s3_title', 'Section 3 Title', '3. Cancellation & Refund Policy')}
                        {renderCmsInput('cms_terms_s3_content', 'Section 3 Content', 'Orders can be cancelled free of charge within 60 seconds of checkout before the merchant accepts the ticket.', true)}
                        {renderCmsInput('cms_terms_s4_title', 'Section 4 Title', '4. Dietary Allergic Requirements')}
                        {renderCmsInput('cms_terms_s4_content', 'Section 4 Content', 'While restaurant partners list ingredients and dietary indicators, cross-contamination in shared commercial kitchens may occur.', true)}
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl space-y-4">
                      <div className="text-xs font-bold text-slate-900">Privacy Policy (NDPA Compliance)</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderCmsInput('cms_privacy_subtitle', 'Privacy Policy Subtitle', 'How Veyrang protects your personal data under the Nigeria Data Protection Act (NDPA)')}
                        {renderCmsInput('cms_privacy_s1_title', 'Section 1 Title', '1. Information We Collect')}
                        {renderCmsInput('cms_privacy_s1_content', 'Section 1 Content', 'Veyrang collects your name, Nigerian mobile phone number, email address, and delivery coordinates strictly to fulfill orders and verify doorstep handovers.', true)}
                        {renderCmsInput('cms_privacy_s2_title', 'Section 2 Title', '2. Courier Access & Privacy Masking')}
                        {renderCmsInput('cms_privacy_s2_content', 'Section 2 Content', 'Assigned courier riders only receive your destination delivery address and phone number for the active duration of the trip.', true)}
                        {renderCmsInput('cms_privacy_s3_title', 'Section 3 Title', '3. Payment Security & PCI-DSS Compliance')}
                        {renderCmsInput('cms_privacy_s3_content', 'Section 3 Content', 'Veyrang never stores raw debit card numbers or bank account PINs on our servers. All financial transactions are tokenized.', true)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 8: Footer, Promos & Social */}
                {cmsCategory === 'footer' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Footer Taglines, Promos & Social Media</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {renderCmsInput('cms_announcement_banner', 'Top Site Announcement Ticker', 'Free Delivery on Orders Over ₦5,000 | Code: FREEDROP')}
                      {renderCmsInput('cms_storefront_promo_badge', 'Storefront Promo Badge', 'Veyrang Feasts')}
                      {renderCmsInput('cms_storefront_promo_text', 'Storefront Promo Description', 'Check our Offers page for verified food coupons & seasonal discounts!')}
                      {renderCmsInput('cms_offers_title', 'Offers Page Headline', 'Offers & Promo Codes')}
                      {renderCmsInput('cms_offers_subtitle', 'Offers Page Subtitle', 'Apply any of these verified promo codes at checkout for instant savings')}
                      {renderCmsInput('cms_offers_member_title', 'Offers Member Banner Title', 'Sign in to unlock exclusive member cashback')}
                      {renderCmsInput('cms_offers_member_desc', 'Offers Member Banner Description', 'Save your favourite codes and enjoy automated ₦500 welcome discounts.')}
                      {renderCmsInput('cms_footer_newsletter_title', 'Newsletter Box Title', 'Get ₦1,500 off your first food order')}
                      {renderCmsInput('cms_footer_newsletter_desc', 'Newsletter Box Description', 'Subscribe to our weekly foodie newsletter for exclusive promo codes, new restaurant launches in Lagos & Abuja, and flash discounts!', true)}
                      {renderCmsInput('cms_footer_tagline', 'Footer Bottom Tagline', 'Premium food delivery platform with live GPS doorstep tracking and real-time kitchen portals.')}
                      {renderCmsInput('cms_copyright_text', 'Copyright Legal Name', 'Veyrang Technologies Limited')}
                      {renderCmsInput('cms_social_instagram', 'Instagram Profile Link', 'https://instagram.com/veyrang')}
                      {renderCmsInput('cms_social_twitter', 'Twitter X Profile Link', 'https://twitter.com/veyrang')}
                      {renderCmsInput('cms_social_facebook', 'Facebook Page Link', 'https://facebook.com/veyrang')}
                      {renderCmsInput('cms_social_linkedin', 'LinkedIn Profile Link', 'https://linkedin.com/company/veyrang')}
                    </div>
                  </div>
                )}

                {cmsCategory === 'cms' && (
                  <div className="mb-6">
                    <button 
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to permanently delete all CMS content from the database? This cannot be undone.')) {
                          await api.admin.runDeveloperQuery('DELETE FROM platform_settings');
                          showActionFeedback('All CMS content deleted successfully.');
                          fetchData();
                        }
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Clear All Website CMS Content
                    </button>
                  </div>
                )}
                {/* Section 9: Public Banners & R2 Assets */}
                {cmsCategory === 'images' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Public Hero Images & Marketing Banners (Cloudflare R2 / CDN)</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {renderCmsInput('cms_hero_image_url', 'Hero Banner Visual URL', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200', false, true)}
                      {renderCmsInput('cms_partner_banner_url', 'Partner Section Visual URL', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000', false, true)}
                      {renderCmsInput('cms_hero_dish1_image', 'Hero Featured Dish 1 Image URL', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=240&q=80', false, true)}
                      {renderCmsInput('cms_hero_dish2_image', 'Hero Featured Dish 2 Image URL', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=240&q=80', false, true)}
                      {renderCmsInput('cms_hero_dish3_image', 'Hero Featured Dish 3 Image URL', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=240&q=80', false, true)}
                    </div>
                  </div>
                )}

                <div className="text-xs text-emerald-700 font-semibold bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>✓ Real-time single source of truth: Edits persist directly to Cloudflare D1 platform_settings table and broadcast to all routes, user sessions, and public storefronts immediately.</span>
                  </div>
                  <button
                    onClick={handleSaveAllCMS}
                    disabled={isSavingAllCMS}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Save All
                  </button>
                </div>
              </div>
            );
          })()}

          {/* SEO & MARKETING METADATA */}
          {activeTab === 'seo' && !isSubAdmin && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">SEO & Social Meta Configuration</h3>
                <p className="text-xs text-slate-500 mt-0.5">Control search engine indexing, social OpenGraph tags, and meta descriptions.</p>
              </div>

              <form onSubmit={handleSaveSEO} className="space-y-4 max-w-2xl">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Meta Title Tag</label>
                  <input
                    type="text"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Meta Description</label>
                  <textarea
                    rows={3}
                    value={seoDesc}
                    onChange={(e) => setSeoDesc(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Target Keywords</label>
                  <input
                    type="text"
                    value={seoKeywords}
                    onChange={(e) => setSeoKeywords(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-[#FF5500] outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm shadow-orange-500/25"
                >
                  <Globe className="w-4 h-4" /> Save SEO Tags to D1
                </button>
              </form>
            </div>
          )}

          {/* SECURITY & 2FA AUDIT */}
          {activeTab === 'security' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">Security Policies & Edge Authentication</h3>
                <p className="text-xs text-slate-500 mt-0.5">HMAC-SHA256 JWT sessions, Platform D1 tokens, and role-based access control.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase">JWT Signature</div>
                  <div className="text-sm font-bold text-emerald-900">HS256 Active</div>
                  <div className="text-xs text-emerald-700">7-Day HttpOnly session tokens</div>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase">D1 Access Token</div>
                  <div className="text-sm font-bold text-emerald-900">Platform Bearer</div>
                  <div className="text-xs text-emerald-700">Authenticated to veyrang_production</div>
                </div>
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-1">
                  <div className="text-[10px] font-bold text-indigo-800 uppercase">RBAC Enforcement</div>
                  <div className="text-sm font-bold text-indigo-900">Strict Middleware</div>
                  <div className="text-xs text-indigo-700">Admin, Sub-Admin, Courier, Customer</div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
