import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { writeRateLimiter, readRateLimiter } from '../../middleware/rateLimiter';
import {
  createSectionSchema, updateSectionSchema, listSectionsQuerySchema,
  createSubsectionSchema, updateSubsectionSchema,
} from './sections.schema';
import * as sectionsService from './sections.service';

const router = Router({ mergeParams: true });

// Sections
router.post(
  '/sections',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  validate({ body: createSectionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const section = await sectionsService.createSection(req.params.orgId, req.body);
      res.status(201).json({ section });
    } catch (err) { next(err); }
  },
);

router.get(
  '/sections',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  validate({ query: listSectionsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeSubsections = req.query.includeSubsections === 'true';
      const sections = await sectionsService.listSections(req.params.orgId, includeSubsections);
      res.status(200).json({ data: sections });
    } catch (err) { next(err); }
  },
);

router.get(
  '/sections/:sectionId',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const section = await sectionsService.getSection(req.params.orgId, req.params.sectionId);
      res.status(200).json({ section });
    } catch (err) { next(err); }
  },
);

router.put(
  '/sections/:sectionId',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  validate({ body: updateSectionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const section = await sectionsService.updateSection(req.params.orgId, req.params.sectionId, req.body);
      res.status(200).json({ section });
    } catch (err) { next(err); }
  },
);

router.delete(
  '/sections/:sectionId',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await sectionsService.deleteSection(req.params.orgId, req.params.sectionId);
      res.status(204).send();
    } catch (err) { next(err); }
  },
);

// Subsections
router.post(
  '/sections/:sectionId/subsections',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  validate({ body: createSubsectionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subsection = await sectionsService.createSubsection(req.params.orgId, req.params.sectionId, req.body);
      res.status(201).json({ subsection });
    } catch (err) { next(err); }
  },
);

router.get(
  '/sections/:sectionId/subsections',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subsections = await sectionsService.listSubsections(req.params.orgId, req.params.sectionId);
      res.status(200).json({ data: subsections });
    } catch (err) { next(err); }
  },
);

router.put(
  '/subsections/:subId',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  validate({ body: updateSubsectionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subsection = await sectionsService.updateSubsection(req.params.orgId, req.params.subId, req.body);
      res.status(200).json({ subsection });
    } catch (err) { next(err); }
  },
);

router.delete(
  '/subsections/:subId',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await sectionsService.deleteSubsection(req.params.orgId, req.params.subId);
      res.status(204).send();
    } catch (err) { next(err); }
  },
);

export default router;
