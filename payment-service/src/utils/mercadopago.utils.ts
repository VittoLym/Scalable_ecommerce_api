import axios from 'axios';

interface TestUser {
  id: number;
  nickname: string;
  password: string;
  email: string;
  site_id: string;
}

class MercadoPagoTestUtils {
  private readonly accessToken: string;
  private readonly siteId: string;

  constructor(accessToken: string, siteId: string = 'MLA') {
    this.accessToken = accessToken;
    this.siteId = siteId;
  }
  async createTestUser(type: 'seller' | 'buyer'): Promise<TestUser> {
    console.log(`🚀 Creando usuario de prueba (${type})...`);
    try {
      const response = await axios.post(
        'https://api.mercadopago.com/users/test_user',
        {
          site_id: this.siteId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`,
          },
        },
      );

      const user = response.data as TestUser;
      console.log('✅ Usuario de prueba creado:');
      console.log(`📧 Email: ${user.email}`);
      console.log(`🔑 Password: ${user.password}`);
      console.log(`🆔 ID: ${user.id}`);
      return user;
    } catch (error) {
      console.error('❌ Error creando usuario de prueba:');
      if (axios.isAxiosError(error)) {
        console.error(error.response?.data || error.message);
      } else {
        console.error(error);
      }
      throw error;
    }
  }
  async createTestUserPair(): Promise<{ seller: TestUser; buyer: TestUser }> {
    console.log('🎭 Creando par de usuarios de prueba...');
    const seller = await this.createTestUser('seller');
    console.log('---');
    const buyer = await this.createTestUser('buyer');
    console.log('\n✅ PAR DE USUARIOS CREADOS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 VENDEDOR:');
    console.log(`   Email: ${seller.email}`);
    console.log(`   Password: ${seller.password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 COMPRADOR:');
    console.log(`   Email: ${buyer.email}`);
    console.log(`   Password: ${buyer.password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return { seller, buyer };
  }
  saveUsersToFile(users: { seller: TestUser; buyer: TestUser }) {
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mercadopago-test-users-${timestamp}.json`;
    const data = {
      createdAt: new Date().toISOString(),
      siteId: this.siteId,
      ...users,
    };
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`💾 Usuarios guardados en: ${filename}`);
  }
}
async function maintest() {
  // ⚠️ Reemplaza con tu ACCESS_TOKEN de PRODUCCIÓN
  const ACCESS_TOKEN =
    'APP_USR-8732602327056289-031223-8319caed4062f27e6115c370e29f15a7-3262716163';
  const utils = new MercadoPagoTestUtils(ACCESS_TOKEN, 'MLA');
  try {
    // Crear par de usuarios
    const users = await utils.createTestUserPair();
    // Guardar en archivo
    utils.saveUsersToFile(users);
  } catch (error) {
    console.error('Error en la creación de usuarios:', error);
  }
}
export default maintest;
