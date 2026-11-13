import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'tienda-forty.cart';

function readStoredCart() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((item) => (
      item
      && typeof item.id === 'string'
      && typeof item.nombre === 'string'
      && Number.isFinite(Number(item.precio))
      && Number(item.precio) >= 0
      && Number.isFinite(Number(item.cantidad))
      && Number(item.cantidad) > 0
      && Number.isFinite(Number(item.stock_actual))
      && Number(item.stock_actual) > 0
    )).map((item) => ({
      ...item,
      precio: Number(item.precio),
      cantidad: Math.min(Number(item.cantidad), Number(item.stock_actual)),
      stock_actual: Number(item.stock_actual),
    }));
  } catch (error) {
    console.error('No se pudo leer el carrito guardado:', error);
    return [];
  }
}

export function getProductPrice(product) {
  const regularPrice = Number(product.precio_venta) || 0;
  const offerPrice = Number(product.precio_oferta);
  const hasOffer = product.en_oferta === true
    && product.precio_oferta !== null
    && product.precio_oferta !== undefined
    && product.precio_oferta !== ''
    && Number.isFinite(offerPrice)
    && offerPrice >= 0
    && offerPrice < regularPrice;
  return hasOffer ? offerPrice : regularPrice;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readStoredCart);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('No se pudo guardar el carrito en este dispositivo:', error);
    }
  }, [items]);

  const addItem = useCallback((product, quantity = 1) => {
    const stock = Number(product.stock_actual);
    const amount = Number(quantity);
    if (!product?.id || !Number.isFinite(stock) || stock <= 0
      || !Number.isInteger(amount) || amount < 1) return false;
    const price = getProductPrice(product);
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => (item.id === product.id
          ? {
            ...item,
            nombre: product.nombre,
            precio: price,
            stock_actual: stock,
            cantidad: Math.min(item.cantidad + amount, stock),
            imagen_url: product.imagen_url || null,
          }
          : item));
      }
      return [...current, {
        id: product.id,
        nombre: product.nombre,
        precio: price,
        cantidad: Math.min(amount, stock),
        stock_actual: stock,
        imagen_url: product.imagen_url || null,
        presentacion_nombre: product.presentacion_nombre || '',
      }];
    });
    return true;
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    const amount = Number(quantity);
    if (!Number.isInteger(amount)) return;
    setItems((current) => current.map((item) => (item.id === productId
      ? { ...item, cantidad: Math.max(1, Math.min(amount, item.stock_actual)) }
      : item)));
  }, []);

  const removeItem = useCallback((productId) => {
    setItems((current) => current.filter((item) => item.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('No se pudo borrar el carrito guardado:', error);
    }
  }, []);
  const total = items.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const itemCount = items.reduce((sum, item) => sum + item.cantidad, 0);
  const value = useMemo(() => ({
    items, total, itemCount, addItem, updateQuantity, removeItem, clearCart,
  }), [addItem, clearCart, itemCount, items, removeItem, total, updateQuantity]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe usarse dentro de CartProvider.');
  return context;
}
