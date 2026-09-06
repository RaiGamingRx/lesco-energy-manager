import { EnergyApplicationService } from './energyService';
import { repository } from '../storage/repository';

// Composition root: replace the repository here when a remote adapter exists.
export const energyApplication = new EnergyApplicationService(repository);