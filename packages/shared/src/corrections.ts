import { z } from 'zod';
import { WorkTypeSchema } from './schemas/common';

/**
 * What a garage may propose when asking ops to fix a submitted job (api/08b): the odometer reading,
 * the service date and the work items with their prices. Never the car or the garage: a wrong car
 * is fixed by merging cars (admin/13). Unknown fields are refused.
 */
export const CorrectionProposalSchema = z
  .strictObject({
    odometerKm: z.number().int().min(0).max(2_000_000).nullable().optional(),
    odometerNotWorking: z.boolean().optional(),
    serviceDate: z.iso.date().optional(),
    items: z
      .array(
        z.strictObject({
          workType: WorkTypeSchema,
          description: z.string().trim().max(200).optional(),
          partName: z.string().trim().max(100).optional(),
          partPricePkr: z.number().int().min(0).max(100_000_000).optional(),
          labourPricePkr: z.number().int().min(0).max(100_000_000).optional(),
        }),
      )
      .min(1)
      .max(20)
      .optional(),
  })
  .refine(
    (p) => Object.keys(p).length > 0,
    'Propose at least one change, or leave the proposal out',
  );

export const CorrectionRequestSchema = z.object({
  /** What's wrong, in the garage's words. */
  message: z.string().trim().min(3).max(1000),
  proposed: CorrectionProposalSchema.optional(),
});
export type CorrectionRequest = z.infer<typeof CorrectionRequestSchema>;
