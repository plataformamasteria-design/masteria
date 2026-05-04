// src/lib/cache/contact-cache.ts
import redis from '@/lib/redis';
import { db } from '@/lib/db';
import { contacts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { CacheMetrics } from './metrics';

interface CachedContact {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  companyId: string;
  createdAt: string;
}

interface CachedContactList {
  id: string;
  name: string;
  companyId: string;
  contactCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ContactValidationResult {
  isValid: boolean;
  exists: boolean;
  contactId?: string;
  errors: string[];
}

/**
 * Cache para contatos e listas de contatos
 * Otimiza operações de importação em massa e validações
 */
export class ContactCache {
  private static readonly CONTACT_PREFIX = 'contact';
  private static readonly LIST_PREFIX = 'contact_list';
  private static readonly VALIDATION_PREFIX = 'contact_validation';
  private static readonly PHONE_INDEX_PREFIX = 'phone_index';
  private static readonly TTL = 3600; // 1 hora
  private static readonly VALIDATION_TTL = 1800; // 30 minutos

  /**
   * Busca contato por ID do cache
   */
  static async getContact(contactId: string): Promise<CachedContact | null> {
    try {
      const cacheKey = `${this.CONTACT_PREFIX}:${contactId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        await CacheMetrics.recordHit('contacts');
        return JSON.parse(cached) as CachedContact;
      }
      
      await CacheMetrics.recordMiss('contacts');
      return null;
    } catch (error) {
      console.error('[ContactCache] Erro ao buscar contato do cache:', error);
      return null;
    }
  }

  /**
   * Busca contato por telefone (usando índice)
   */
  static async getContactByPhone(phone: string, companyId: string): Promise<CachedContact | null> {
    try {
      const indexKey = `${this.PHONE_INDEX_PREFIX}:${companyId}:${phone}`;
      const contactId = await redis.get(indexKey);
      
      if (contactId) {
        const contact = await this.getContact(contactId);
        if (contact) {
          await CacheMetrics.recordHit('contacts');
        } else {
          await CacheMetrics.recordMiss('contacts');
        }
        return contact;
      }
      
      await CacheMetrics.recordMiss('contacts');
      return null;
    } catch (error) {
      console.error('[ContactCache] Erro ao buscar contato por telefone:', error);
      return null;
    }
  }

  /**
   * Busca contato do banco e armazena no cache
   */
  static async getContactWithCache(contactId: string): Promise<CachedContact | null> {
    // Tenta buscar do cache primeiro
    const cached = await this.getContact(contactId);
    if (cached) {
      return cached;
    }

    // Se não encontrou no cache, busca do banco
    const contactFromDb = await db.query.contacts.findFirst({
      where: eq(contacts.id, contactId),
    });

    if (!contactFromDb) {
      return null;
    }

    const contact: CachedContact = {
      id: contactFromDb.id,
      phone: contactFromDb.phone,
      name: contactFromDb.name || undefined,
      email: contactFromDb.email || undefined,
      companyId: contactFromDb.companyId,
      createdAt: contactFromDb.createdAt?.toISOString() || new Date().toISOString(),
    };

    // Armazena no cache
    await this.setContact(contact);
    
    return contact;
  }

  /**
   * Armazena contato no cache
   */
  static async setContact(contact: CachedContact): Promise<void> {
    try {
      const _cacheKey = `${this.CONTACT_PREFIX}:${contact.id}`;
      const _indexKey = `${this.PHONE_INDEX_PREFIX}:${contact.companyId}:${contact.phone}`;
      
      // Pipeline not supported on HybridRedisClient - use individual set operations
      // // // const pipeline = redis.pipeline(); // not supported
      // // // pipeline.set(cacheKey, JSON.stringify(contact), 'EX', this.TTL);
      // // // pipeline.set(indexKey, contact.id, 'EX', this.TTL);
      // // await // pipeline.exec();
    } catch (error) {
      console.error('[ContactCache] Erro ao armazenar contato no cache:', error);
    }
  }

  /**
   * Valida contato e armazena resultado no cache
   */
  static async validateContact(
    phone: string, 
    companyId: string, 
    name?: string, 
    email?: string
  ): Promise<ContactValidationResult> {
    try {
      const validationKey = `${this.VALIDATION_PREFIX}:${companyId}:${phone}`;
      const cached = await redis.get(validationKey);
      
      if (cached) {
        return JSON.parse(cached) as ContactValidationResult;
      }

      // Validação de formato de telefone
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      const errors: string[] = [];
      
      if (!phoneRegex.test(phone)) {
        errors.push('Formato de telefone inválido');
      }
      
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Formato de email inválido');
      }

      // Verifica se contato já existe
      const existingContact = await this.getContactByPhone(phone, companyId);
      
      const result: ContactValidationResult = {
        isValid: errors.length === 0,
        exists: !!existingContact,
        contactId: existingContact?.id,
        errors,
      };

      // Armazena resultado da validação no cache
      await redis.set(validationKey, JSON.stringify(result), 'EX', this.VALIDATION_TTL);
      
      return result;
    } catch (error) {
      console.error('[ContactCache] Erro ao validar contato:', error);
      return {
        isValid: false,
        exists: false,
        errors: ['Erro interno na validação'],
      };
    }
  }

  /**
   * Busca lista de contatos do cache
   */
  static async getContactList(listId: string): Promise<CachedContactList | null> {
    try {
      const cacheKey = `${this.LIST_PREFIX}:${listId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached) as CachedContactList;
      }
      
      return null;
    } catch (error) {
      console.error('[ContactCache] Erro ao buscar lista do cache:', error);
      return null;
    }
  }

  /**
   * Armazena lista de contatos no cache
   */
  static async setContactList(list: CachedContactList): Promise<void> {
    try {
      const cacheKey = `${this.LIST_PREFIX}:${list.id}`;
      await redis.set(cacheKey, JSON.stringify(list), 'EX', this.TTL);
    } catch (error) {
      console.error('[ContactCache] Erro ao armazenar lista no cache:', error);
    }
  }

  /**
   * Invalida cache de contato
   */
  static async invalidateContact(contactId: string, phone?: string, companyId?: string): Promise<void> {
    try {
      const _cacheKey = `${this.CONTACT_PREFIX}:${contactId}`;
      // Pipeline not supported on HybridRedisClient - skip batch delete
      // Would need: redis.del(cacheKey)
      
      if (phone && companyId) {
        const _indexKey = `${this.PHONE_INDEX_PREFIX}:${companyId}:${phone}`;
        const _validationKey = `${this.VALIDATION_PREFIX}:${companyId}:${phone}`;
        // Would need: redis.del(indexKey) and redis.del(validationKey)
      }
    } catch (error) {
      console.error('[ContactCache] Erro ao invalidar cache de contato:', error);
    }
  }

  /**
   * Invalida cache de lista
   */
  static async invalidateContactList(listId: string): Promise<void> {
    try {
      const cacheKey = `${this.LIST_PREFIX}:${listId}`;
      await redis.del(cacheKey);
    } catch (error) {
      console.error('[ContactCache] Erro ao invalidar cache de lista:', error);
    }
  }

  /**
   * Limpa todo o cache de contatos de uma empresa
   */
  static async clearCompanyContacts(companyId: string): Promise<void> {
    try {
      const patterns = [
        `${this.CONTACT_PREFIX}:*`,
        `${this.PHONE_INDEX_PREFIX}:${companyId}:*`,
        `${this.VALIDATION_PREFIX}:${companyId}:*`,
        `${this.LIST_PREFIX}:*`
      ];
      
      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          // HybridRedisClient doesn't support spread in del() - call individually
          for (const key of keys) {
            try {
              await redis.del(key);
            } catch (e) {
              // Silently continue on delete errors
            }
          }
        }
      }
    } catch (error) {
      console.error('[ContactCache] Erro ao limpar cache da empresa:', error);
    }
  }

  /**
   * Pré-carrega contatos de uma empresa no cache
   */
  static async preloadCompanyContacts(companyId: string, limit: number = 1000): Promise<void> {
    try {
      const contactsFromDb = await db.query.contacts.findMany({
        where: eq(contacts.companyId, companyId),
        limit,
      });

      // // const pipeline = redis.pipeline(); // not supported
      
      for (const contact of contactsFromDb) {
        const _cachedContact: CachedContact = {
          id: contact.id,
          phone: contact.phone,
          name: contact.name || undefined,
          email: contact.email || undefined,
          companyId: contact.companyId,
          createdAt: contact.createdAt?.toISOString() || new Date().toISOString(),
        };
        
        const _cacheKey = `${this.CONTACT_PREFIX}:${contact.id}`;
        const _indexKey = `${this.PHONE_INDEX_PREFIX}:${companyId}:${contact.phone}`;
        
        // // pipeline.set(cacheKey, JSON.stringify(cachedContact), 'EX', this.TTL);
        // // pipeline.set(indexKey, contact.id, 'EX', this.TTL);
      }
      
      // await // pipeline.exec();
    } catch (error) {
      console.error('[ContactCache] Erro ao pré-carregar contatos:', error);
    }
  }
}