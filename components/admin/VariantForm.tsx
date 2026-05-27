import {
  Field,
  NumberInput,
  PrimaryButton,
  TextInput,
} from "@/components/admin/Field";

import type { ProductVariant } from "@/drizzle/schema";

/*
 * Variant form, shared between new + edit. Dimensions accept either three
 * numeric (w/h/d in mm) or a freeform label for irregular fits (e.g.
 * "Fits iPhone 16").
 */

export function VariantForm({
  productId,
  variant,
  action,
  submitLabel,
}: {
  productId: string;
  variant?: ProductVariant;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
}) {
  const dim = (variant?.dimensionsMm ?? {}) as {
    w?: number;
    h?: number;
    d?: number;
    label?: string;
  };

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="productId" value={productId} />
      {variant ? <input type="hidden" name="id" value={variant.id} /> : null}

      <div className="grid grid-cols-2 gap-4">
        <Field label="SKU" htmlFor="sku" required hint="Unique across the catalog">
          <TextInput id="sku" name="sku" required defaultValue={variant?.sku} placeholder="SF-crystal-cube-80" />
        </Field>
        <Field label="Display name" htmlFor="name" required>
          <TextInput id="name" name="name" required defaultValue={variant?.name} placeholder="80 mm cube" />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Price delta (cents)" htmlFor="priceDeltaCents" hint="Added to product base price">
          <NumberInput
            id="priceDeltaCents"
            name="priceDeltaCents"
            step={100}
            defaultValue={variant?.priceDeltaCents ?? 0}
          />
        </Field>
        <Field label="Inventory" htmlFor="inventoryCount" hint="Leave blank = made to order">
          <NumberInput
            id="inventoryCount"
            name="inventoryCount"
            min={0}
            defaultValue={variant?.inventoryCount ?? undefined}
          />
        </Field>
        <Field label="Weight (g)" htmlFor="weightGrams">
          <NumberInput
            id="weightGrams"
            name="weightGrams"
            min={0}
            defaultValue={variant?.weightGrams ?? undefined}
          />
        </Field>
      </div>

      <fieldset className="border border-[color:var(--color-paper-300)] p-4">
        <legend className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] px-2">
          Dimensions (mm)
        </legend>
        <div className="grid grid-cols-4 gap-3 mt-2">
          <Field label="W" htmlFor="dimW">
            <NumberInput id="dimW" name="dimW" step={0.1} defaultValue={dim.w ?? undefined} />
          </Field>
          <Field label="H" htmlFor="dimH">
            <NumberInput id="dimH" name="dimH" step={0.1} defaultValue={dim.h ?? undefined} />
          </Field>
          <Field label="D" htmlFor="dimD">
            <NumberInput id="dimD" name="dimD" step={0.1} defaultValue={dim.d ?? undefined} />
          </Field>
          <Field
            label="Label override"
            htmlFor="dimLabel"
            hint='Optional. E.g. "Fits iPhone 16"'
          >
            <TextInput id="dimLabel" name="dimLabel" defaultValue={dim.label ?? ""} />
          </Field>
        </div>
      </fieldset>

      <div className="pt-4">
        <PrimaryButton type="submit">{submitLabel}</PrimaryButton>
      </div>
    </form>
  );
}
