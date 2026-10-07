import React, { useState } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { MenuItem, SelectedOption } from '../../types';
import { formatCurrency } from '../../utils/format';
import { X, Plus, Minus, Check } from 'lucide-react';

export const DishCustomizationModal: React.FC = () => {
  const { customizingItem, closeCustomizer, addToCart, currency } = useDelivery();

  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, SelectedOption[]>>({});
  const [instructions, setInstructions] = useState('');

  if (!customizingItem) return null;

  const item = customizingItem;

  const handleSelectRadio = (groupId: string, groupName: string, option: { id: string; name: string; price: number }) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [groupId]: [
        {
          groupId,
          groupName,
          optionId: option.id,
          optionName: option.name,
          price: option.price
        }
      ]
    }));
  };

  const handleToggleCheckbox = (
    groupId: string,
    groupName: string,
    option: { id: string; name: string; price: number }
  ) => {
    setSelectedOptions((prev) => {
      const current = prev[groupId] || [];
      const exists = current.some((o) => o.optionId === option.id);
      if (exists) {
        return {
          ...prev,
          [groupId]: current.filter((o) => o.optionId !== option.id)
        };
      } else {
        return {
          ...prev,
          [groupId]: [
            ...current,
            {
              groupId,
              groupName,
              optionId: option.id,
              optionName: option.name,
              price: option.price
            }
          ]
        };
      }
    });
  };

  const flatSelectedOptions: SelectedOption[] = Object.values(selectedOptions).flat();
  const optionsTotal = flatSelectedOptions.reduce((sum, opt) => sum + opt.price, 0);
  const totalItemPrice = (item.price + optionsTotal) * quantity;

  const allRequiredChosen = (item.customizations || [])
    .filter((g) => g.required)
    .every((g) => selectedOptions[g.id] && selectedOptions[g.id].length > 0);

  const handleAddToCart = () => {
    if (!allRequiredChosen) return;
    addToCart(item, quantity, flatSelectedOptions, instructions.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-slate-900">
        {/* Header */}
        <div className="relative p-5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
          <button
            onClick={closeCustomizer}
            aria-label="Close customizer"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="pr-10">
            <h2 className="text-lg sm:text-xl font-bold font-display text-slate-900">
              {item.name}
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {item.description}
            </p>
            <div className="mt-2 text-base font-bold text-orange-600 font-mono tabular-nums">
              {formatCurrency(item.price, currency)}
            </div>
          </div>
        </div>

        {/* Customization Options Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
          {(item.customizations || []).map((group) => {
            const currentSelected = selectedOptions[group.id] || [];

            return (
              <div key={group.id} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      {group.name}
                    </span>
                    {group.required && (
                      <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.2 rounded">
                        Required
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {group.required ? 'Choose 1' : 'Optional'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {group.options.map((opt) => {
                    const isSelected = currentSelected.some((o) => o.optionId === opt.id);

                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer text-xs ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50/40 text-slate-900 font-semibold'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type={group.required ? 'radio' : 'checkbox'}
                            name={group.id}
                            checked={isSelected}
                            onChange={() => {
                              if (group.required) {
                                handleSelectRadio(group.id, group.name, opt);
                              } else {
                                handleToggleCheckbox(group.id, group.name, opt);
                              }
                            }}
                            className="text-orange-600 focus:ring-0 cursor-pointer"
                          />
                          <span>{opt.name}</span>
                        </div>

                        {opt.price > 0 && (
                          <span className="font-mono font-bold text-slate-700">
                            +{formatCurrency(opt.price, currency)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Special Instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Kitchen Notes & Instructions
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Extra napkins, no pepper, please ring doorbell..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Footer with Quantity & Add Button */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg bg-white text-slate-700 hover:text-orange-600 flex items-center justify-center shadow-xs cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-slate-900 w-5 text-center font-mono">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 rounded-lg bg-white text-slate-700 hover:text-orange-600 flex items-center justify-center shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={!allRequiredChosen}
            className="flex-1 py-3 px-4 rounded-2xl bg-orange-600 text-white font-bold text-xs sm:text-sm hover:bg-orange-700 transition-colors shadow-md shadow-orange-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-between"
          >
            <span>{allRequiredChosen ? 'Add to cart' : 'Make required choices'}</span>
            <span className="font-mono tabular-nums">{formatCurrency(totalItemPrice, currency)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
