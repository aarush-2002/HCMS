import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={`flex items-center gap-1 border-b border-[rgba(223,231,224,0.16)] pb-px overflow-x-auto ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`min-h-[44px] px-4 py-2 text-sm font-medium transition-all relative whitespace-nowrap focus:outline-none focus-visible:outline-2 focus-visible:outline-[#f5a524] rounded-t-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              isActive
                ? 'text-[#f5a524] border-b-2 border-[#f5a524] bg-[rgba(245,165,36,0.06)]'
                : 'text-[#9aa5a0] hover:text-[#dfe7e0] hover:bg-[rgba(223,231,224,0.04)] border-b-2 border-transparent'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`ml-2 text-xs px-1.5 py-0.5 rounded-sm ${
                  isActive
                    ? 'bg-[#f5a524]/20 text-[#f5a524]'
                    : 'bg-[rgba(223,231,224,0.1)] text-[#9aa5a0]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
