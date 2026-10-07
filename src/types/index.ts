export type UserRole = 'customer' | 'restaurant' | 'courier' | 'admin' | 'sub_admin';

export type ActivePage =
  | 'landing'
  | 'home'
  | 'restaurants'
  | 'search'
  | 'offers'
  | 'orders'
  | 'favourites'
  | 'account'
  | 'help'
  | 'partner'
  | 'terms'
  | 'privacy'
  | 'contact';

export type Currency = 'USD' | 'NGN';

export type FulfillmentType = 'delivery' | 'pickup' | 'scheduled';

export type DeliveryZone = 'LEKKI' | 'VI' | 'IKOYI' | 'IKEJA' | 'YABA' | 'ABUJA' | 'NYC' | 'LAGOS';

export type DietaryTag = 'Vegan' | 'Vegetarian' | 'Halal' | 'Gluten-Free' | 'Chef Special';

export type PriceTier = '$' | '$$' | '$$$';

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  apartment?: string;
  city: string;
  isDefault?: boolean;
}

export interface CustomizationOption {
  id: string;
  name: string;
  price: number;
}

export interface CustomizationGroup {
  id: string;
  name: string;
  required: boolean;
  maxSelect?: number;
  options: CustomizationOption[];
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  dietary: DietaryTag[];
  popular?: boolean;
  calories?: number;
  prepTimeMin: number;
  isAvailable: boolean;
  customizations?: CustomizationGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  items: MenuItem[];
}

export interface Restaurant {
  id: string;
  name: string;
  tagline: string;
  cuisine: string;
  rating: number;
  reviewCount: number;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  deliveryFee: number;
  minOrder: number;
  priceTier: PriceTier;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  distanceText?: string;
  durationMinutes?: number;
  durationText?: string;
  calculatedDeliveryFee?: number;
  inDeliveryRadius?: boolean;
  isLiveRoadDistance?: boolean;
  routingEngine?: string;
  tags: string[];
  badge?: string;
  accentColor: string;
  iconName: string;
  isOpen: boolean;
  isBusyPaused?: boolean;
  commissionPercent?: number;
  zone?: DeliveryZone;
  categories: MenuCategory[];
}

export interface SelectedOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface CartItem {
  cartItemId: string;
  menuItem: MenuItem;
  quantity: number;
  selectedOptions: SelectedOption[];
  specialInstructions?: string;
  itemTotal: number;
}

export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export interface OrderStatusEvent {
  status: OrderStatus;
  timestamp: string;
  note: string;
}

export interface CourierInfo {
  id?: string;
  name: string;
  phone: string;
  rating: number;
  vehicle: string;
  plateNumber: string;
  tripsCompleted: number;
  avatarSeed?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'courier' | 'system';
  senderName?: string;
  text: string;
  timestamp: string;
}

export interface Order {
  id: string;
  shortId: string;
  createdAt: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerApartment?: string;
  deliveryNotes?: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  tip: number;
  discountAmount?: number;
  walletDeduction?: number;
  total: number;
  currency?: Currency;
  fulfillmentType?: FulfillmentType;
  scheduledSlot?: string;
  isContactless?: boolean;
  promoCode?: string;
  handoverPin?: string;
  prepTimeAdjustmentMin?: number;
  paymentMethod: string;
  paymentStatus?: 'pending' | 'paid' | 'refunded' | 'failed';
  transactionRef?: string;
  status: OrderStatus;
  statusHistory: OrderStatusEvent[];
  courier?: CourierInfo;
  routeProgress: number; // 0 to 100 percentage
  estimatedArrivalMinutes: number;
  messages: ChatMessage[];
}
