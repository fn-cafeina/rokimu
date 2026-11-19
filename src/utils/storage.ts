import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./logger";

/** An unreadable blob is parked here so the next write cannot erase it. */
export const UNREADABLE_PREFIX = "backup_unreadable_";

class Storage {
  async get<T>(key: string): Promise<T | null> {
    let data: string | null;
    try {
      data = await AsyncStorage.getItem(key);
    } catch (error) {
      logger.error("Storage", `Failed to get key: ${key}`, error);
      return null;
    }
    if (data == null) return null;
    try {
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error("Storage", `Unreadable value for key: ${key}`, error);
      // Without the copy the caller would start empty and overwrite the only
      // remaining bytes of a library or a download index on its next save
      await this.park(key, data);
      return null;
    }
  }

  private async park(key: string, raw: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`${UNREADABLE_PREFIX}${key}`, raw);
    } catch (error) {
      logger.error("Storage", `Failed to park unreadable key: ${key}`, error);
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      logger.error("Storage", `Failed to set key: ${key}`, error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      logger.error("Storage", `Failed to remove key: ${key}`, error);
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      return [...(await AsyncStorage.getAllKeys())];
    } catch (error) {
      logger.error("Storage", "Failed to get all keys", error);
      return [];
    }
  }
}

export const storage = new Storage();
