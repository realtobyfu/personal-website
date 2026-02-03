import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    date: z.date(),
    location: z.string().optional(),
    type: z.enum(['essay', 'photos']),
    description: z.string(),
    tag: z.string(),
    draft: z.boolean().default(false),
    cover: image().optional(),
    images: z.array(z.object({
      src: image(),
      caption: z.string().optional(),
    })).optional(),
  }),
});

export const collections = {
  blog: blogCollection,
};
