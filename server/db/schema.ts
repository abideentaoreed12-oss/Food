import { z } from 'zod';

export const UserRoleSchema = z.enum(['customer', 'restaurant', 'courier', 'admin', 'sub_admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const SavedAddressSchema = z.object({
  id: z.string(),
  label: z.enum(['Home', 'Work', 'Other']),
  address: z.string(),
  apartment: z.string().optional(),
  city: z.string(),
  isDefault: z.boolean().default(false)
});
export type SavedAddress = z.infer<typeof SavedAddressSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
  name: z.string().min(2),
  role: UserRoleSchema,
  phone: z.string().optional(),
  address: z.string().optional(),
  restaurantId: z.string().optional(), // if role === 'restaurant'
  walletBalanceUSD: z.number().nonnegative().default(0),
  walletBalanceNGN: z.number().nonnegative().default(0),
  savedAddresses: z.array(SavedAddressSchema).default([]),
  accessibleRoles: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type User = z.infer<typeof UserSchema>;

export const DietaryTagSchema = z.enum(['Vegan', 'Vegetarian', 'Halal', 'Gluten-Free', 'Chef Special']);
export type DietaryTag = z.infer<typeof DietaryTagSchema>;

export const CustomizationOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative()
});

export const CustomizationGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  required: z.boolean(),
  maxSelect: z.number().optional(),
  options: z.array(CustomizationOptionSchema)
});

export const MenuItemSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number().positive(),
  category: z.string(),
  dietary: z.array(DietaryTagSchema),
  popular: z.boolean().optional(),
  calories: z.number().optional(),
  prepTimeMin: z.number().int().positive(),
  isAvailable: z.boolean(),
  customizations: z.array(CustomizationGroupSchema).optional()
});
export type MenuItem = z.infer<typeof MenuItemSchema>;

export const MenuCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  items: z.array(MenuItemSchema)
});

export const RestaurantSchema = z.object({
  id: z.string(),
  ownerId: z.string().optional(),
  name: z.string(),
  tagline: z.string(),
  cuisine: z.string(),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
  deliveryTimeMin: z.number().int().positive(),
  deliveryTimeMax: z.number().int().positive(),
  deliveryFee: z.number().nonnegative(),
  minOrder: z.number().nonnegative(),
  priceTier: z.enum(['$', '$$', '$$$']),
  address: z.string(),
  distanceKm: z.number().nonnegative(),
  tags: z.array(z.string()),
  badge: z.string().optional(),
  accentColor: z.string(),
  isOpen: z.boolean(),
  isBusyPaused: z.boolean().default(false),
  commissionPercent: z.number().default(15),
  zone: z.enum(['NYC', 'LAGOS', 'ABUJA']).default('NYC'),
  categories: z.array(MenuCategorySchema),
  createdAt: z.string()
});
export type Restaurant = z.infer<typeof RestaurantSchema>;

export const SelectedOptionSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  optionId: z.string(),
  optionName: z.string(),
  price: z.number().nonnegative()
});

export const CartItemSchema = z.object({
  cartItemId: z.string(),
  menuItemId: z.string(),
  name: z.string(),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
  selectedOptions: z.array(SelectedOptionSchema),
  specialInstructions: z.string().max(250).optional(),
  itemTotal: z.number().positive()
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const OrderStatusSchema = z.enum([
  'placed',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'in_transit',
  'delivered',
  'cancelled'
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderStatusEventSchema = z.object({
  status: OrderStatusSchema,
  timestamp: z.string(),
  note: z.string()
});

export const CourierInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  rating: z.number(),
  vehicle: z.string(),
  plateNumber: z.string(),
  tripsCompleted: z.number().int()
});
export type CourierInfo = z.infer<typeof CourierInfoSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  sender: z.enum(['customer', 'courier', 'system']),
  senderName: z.string(),
  text: z.string(),
  timestamp: z.string()
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  shortId: z.string(),
  createdAt: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  customerAddress: z.string(),
  customerApartment: z.string().optional(),
  deliveryNotes: z.string().optional(),
  restaurantId: z.string(),
  restaurantName: z.string(),
  restaurantAddress: z.string(),
  items: z.array(CartItemSchema),
  subtotal: z.number().nonnegative(),
  deliveryFee: z.number().nonnegative(),
  serviceFee: z.number().nonnegative(),
  tip: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().default(0),
  walletDeduction: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  currency: z.enum(['USD', 'NGN']).default('USD'),
  fulfillmentType: z.enum(['delivery', 'pickup', 'scheduled']).default('delivery'),
  scheduledSlot: z.string().optional(),
  isContactless: z.boolean().default(false),
  promoCode: z.string().optional(),
  handoverPin: z.string().default('4821'),
  prepTimeAdjustmentMin: z.number().default(0),
  paymentMethod: z.string(),
  paymentStatus: z.enum(['pending', 'paid', 'refunded', 'failed']),
  transactionRef: z.string(),
  status: OrderStatusSchema,
  statusHistory: z.array(OrderStatusEventSchema),
  courier: CourierInfoSchema.optional(),
  routeProgress: z.number().min(0).max(100),
  estimatedArrivalMinutes: z.number().int().nonnegative(),
  messages: z.array(ChatMessageSchema),
  updatedAt: z.string()
});
export type Order = z.infer<typeof OrderSchema>;

export const TransactionSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  reference: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']),
  paymentMethod: z.string(),
  idempotencyKey: z.string(),
  createdAt: z.string()
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const AuditLogSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  userEmail: z.string().optional(),
  userRole: z.string().optional(),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().optional(),
  ip: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
  timestamp: z.string()
});
export type AuditLog = z.infer<typeof AuditLogSchema>;
