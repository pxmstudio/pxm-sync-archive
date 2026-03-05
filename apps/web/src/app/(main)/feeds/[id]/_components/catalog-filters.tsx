"use client";

import { useState } from "react";
import {
  SlidersHorizontal,
  ChevronDown,
  X,
  Tag,
  Layers,
  FolderOpen,
  Search,
} from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import type {
  BrandFacet,
  ProductTypeFacet,
  CollectionFacet,
  CatalogFacets,
} from "@/hooks/use-feed-catalog";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
import { Input } from "@workspace/ui/components/input";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Separator } from "@workspace/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
import { cn } from "@workspace/ui/lib/utils";

export interface CatalogFiltersState {
  brands: string[];
  productTypes: string[];
  collectionIds: string[];
}

interface CatalogFiltersProps {
  facets: CatalogFacets;
  filters: CatalogFiltersState;
  onFiltersChange: (filters: CatalogFiltersState) => void;
}

// Filter section component
function FilterSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium hover:text-foreground/80 transition-colors">
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

// Checkbox list with search
function FilterCheckboxList({
  items,
  selectedItems,
  onToggle,
  getLabel,
  getValue,
  getCount,
  searchPlaceholder = "Search...",
  maxVisible = 8,
  showMoreText,
  showLessText,
  noResultsText,
}: {
  items: unknown[];
  selectedItems: string[];
  onToggle: (value: string) => void;
  getLabel: (item: unknown) => string;
  getValue: (item: unknown) => string;
  getCount?: (item: unknown) => number;
  searchPlaceholder?: string;
  maxVisible?: number;
  showMoreText?: string;
  showLessText?: string;
  noResultsText?: string;
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filteredItems = items.filter((item) =>
    getLabel(item).toLowerCase().includes(search.toLowerCase())
  );

  const visibleItems = showAll
    ? filteredItems
    : filteredItems.slice(0, maxVisible);
  const hasMore = filteredItems.length > maxVisible;

  return (
    <div className="space-y-2">
      {items.length > maxVisible && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      )}
      <div className="space-y-1">
        {visibleItems.map((item) => {
          const value = getValue(item);
          const label = getLabel(item);
          const count = getCount?.(item);
          const isSelected = selectedItems.includes(value);

          return (
            <label
              key={value}
              className={cn(
                "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
                "hover:bg-muted/50",
                isSelected && "bg-muted"
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle(value)}
                className="h-4 w-4"
              />
              <span className="flex-1 text-sm">{label}</span>
              {count !== undefined && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {count}
                </span>
              )}
            </label>
          );
        })}
      </div>
      {hasMore && !search && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs h-7"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (showLessText || "Show less") : (showMoreText || `Show ${filteredItems.length - maxVisible} more`)}
        </Button>
      )}
      {filteredItems.length === 0 && search && (
        <p className="text-xs text-muted-foreground text-center py-2">
          {noResultsText || "No results found"}
        </p>
      )}
    </div>
  );
}

// The main filter content
function FiltersContent({
  facets,
  filters,
  onFiltersChange,
}: CatalogFiltersProps) {
  const { t } = useTranslation("suppliers");

  const toggleBrand = (name: string) => {
    const newBrands = filters.brands.includes(name)
      ? filters.brands.filter((b) => b !== name)
      : [...filters.brands, name];
    onFiltersChange({ ...filters, brands: newBrands });
  };

  const toggleProductType = (name: string) => {
    const newTypes = filters.productTypes.includes(name)
      ? filters.productTypes.filter((t) => t !== name)
      : [...filters.productTypes, name];
    onFiltersChange({ ...filters, productTypes: newTypes });
  };

  const toggleCollection = (id: string) => {
    const newCollections = filters.collectionIds.includes(id)
      ? filters.collectionIds.filter((c) => c !== id)
      : [...filters.collectionIds, id];
    onFiltersChange({ ...filters, collectionIds: newCollections });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      brands: [],
      productTypes: [],
      collectionIds: [],
    });
  };

  const activeFilterCount =
    filters.brands.length +
    filters.productTypes.length +
    filters.collectionIds.length;

  const remainingBrands = facets.brands.length - 8;
  const remainingTypes = facets.productTypes.length - 8;
  const remainingCollections = facets.collections.length - 8;

  return (
    <div className="space-y-1">
      {/* Header with clear all */}
      <div className="flex items-center justify-between pb-2">
        <h3 className="font-semibold">{t("filters.title")}</h3>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={clearAllFilters}
          >
            {t("filters.clearAll")}
          </Button>
        )}
      </div>

      <Separator />

      {/* Brands */}
      {facets.brands.length > 0 && (
        <>
          <FilterSection title={t("filters.brands")} icon={Tag}>
            <FilterCheckboxList
              items={facets.brands}
              selectedItems={filters.brands}
              onToggle={toggleBrand}
              getLabel={(item) => (item as BrandFacet).name}
              getValue={(item) => (item as BrandFacet).name}
              getCount={(item) => (item as BrandFacet).productCount}
              searchPlaceholder={t("filters.searchBrands")}
              showMoreText={t("filters.showMore", { count: remainingBrands })}
              showLessText={t("filters.showLess")}
              noResultsText={t("filters.noResults")}
            />
          </FilterSection>
          <Separator />
        </>
      )}

      {/* Product Types */}
      {facets.productTypes.length > 0 && (
        <>
          <FilterSection title={t("filters.productTypes")} icon={Layers}>
            <FilterCheckboxList
              items={facets.productTypes}
              selectedItems={filters.productTypes}
              onToggle={toggleProductType}
              getLabel={(item) => (item as ProductTypeFacet).name}
              getValue={(item) => (item as ProductTypeFacet).name}
              getCount={(item) => (item as ProductTypeFacet).productCount}
              searchPlaceholder={t("filters.searchTypes")}
              showMoreText={t("filters.showMore", { count: remainingTypes })}
              showLessText={t("filters.showLess")}
              noResultsText={t("filters.noResults")}
            />
          </FilterSection>
          <Separator />
        </>
      )}

      {/* Collections */}
      {facets.collections.length > 0 && (
        <FilterSection title={t("filters.collections")} icon={FolderOpen}>
          <FilterCheckboxList
            items={facets.collections}
            selectedItems={filters.collectionIds}
            onToggle={toggleCollection}
            getLabel={(item) => (item as CollectionFacet).title}
            getValue={(item) => (item as CollectionFacet).id}
            searchPlaceholder={t("filters.searchCollections")}
            showMoreText={t("filters.showMore", { count: remainingCollections })}
            showLessText={t("filters.showLess")}
            noResultsText={t("filters.noResults")}
          />
        </FilterSection>
      )}
    </div>
  );
}

// Active filters display
export function CatalogActiveFilters({
  filters,
  facets,
  onFiltersChange,
}: CatalogFiltersProps) {
  const { t } = useTranslation("suppliers");
  const activeFilters: { type: string; value: string; label: string }[] = [];

  // Add brand filters
  filters.brands.forEach((name) => {
    activeFilters.push({ type: "brand", value: name, label: name });
  });

  // Add product type filters
  filters.productTypes.forEach((name) => {
    activeFilters.push({ type: "productType", value: name, label: name });
  });

  // Add collection filters
  filters.collectionIds.forEach((id) => {
    const collection = facets.collections.find((c) => c.id === id);
    if (collection) {
      activeFilters.push({
        type: "collection",
        value: id,
        label: collection.title,
      });
    }
  });

  if (activeFilters.length === 0) return null;

  const removeFilter = (type: string, value: string) => {
    switch (type) {
      case "brand":
        onFiltersChange({
          ...filters,
          brands: filters.brands.filter((b) => b !== value),
        });
        break;
      case "productType":
        onFiltersChange({
          ...filters,
          productTypes: filters.productTypes.filter((t) => t !== value),
        });
        break;
      case "collection":
        onFiltersChange({
          ...filters,
          collectionIds: filters.collectionIds.filter((c) => c !== value),
        });
        break;
    }
  };

  const clearAll = () => {
    onFiltersChange({
      brands: [],
      productTypes: [],
      collectionIds: [],
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {activeFilters.map(({ type, value, label }) => (
        <Badge
          key={`${type}-${value}`}
          variant="secondary"
          className="gap-1 pr-1"
        >
          {label}
          <button
            onClick={() => removeFilter(type, value)}
            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {activeFilters.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground"
          onClick={clearAll}
        >
          {t("filters.clearAll")}
        </Button>
      )}
    </div>
  );
}

// Desktop sidebar
export function CatalogFiltersSidebar(props: CatalogFiltersProps) {
  return (
    <aside className="hidden lg:block w-72 shrink-0">
      <ScrollArea className="h-[calc(100vh-16rem)] pr-4">
        <FiltersContent {...props} />
      </ScrollArea>
    </aside>
  );
}

// Mobile sheet trigger and content
export function CatalogFiltersMobile(props: CatalogFiltersProps) {
  const { t } = useTranslation("suppliers");
  const [open, setOpen] = useState(false);

  const activeFilterCount =
    props.filters.brands.length +
    props.filters.productTypes.length +
    props.filters.collectionIds.length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          {t("filters.title")}
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>{t("filters.title")}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-5rem)] p-4">
          <FiltersContent {...props} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
