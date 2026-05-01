import { z } from "zod";

const positiveInt = (field: string) =>
  z
    .number({ error: `${field} must be a positive integer` })
    .int(`${field} must be an integer`)
    .positive(`${field} must be a positive integer`);

const coerce = (defaultValue: number) => (value: unknown) =>
  value === undefined || value === null || value === "" ? defaultValue : Number(value);

export interface PaginationSchemaOptions {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
}

export const paginationQuerySchema = ({
  defaultPage = 1,
  defaultLimit = 20,
  maxLimit = 100,
}: PaginationSchemaOptions = {}) =>
  z.object({
    page: z.preprocess(coerce(defaultPage), positiveInt("page")),
    limit: z
      .preprocess(coerce(defaultLimit), positiveInt("limit"))
      .transform(value => Math.min(value, maxLimit)),
  });
