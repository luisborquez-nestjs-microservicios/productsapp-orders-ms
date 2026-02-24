# Orders Microservice

## Dev
1. Crear archivo <i>.env</i> en base a <i>.env.template</i>
2. Configurar las variables de entorno necesarias
3. Instalar dependencias: `npm install`
4. Levantar el servidor de NATS (Docker)
    - Validar si está creado el contenedor y si está en ejecución: 
    ```
    docker ps -a -f "name=nats-server"
    ```
    - Si no está creado el contenedor, crear y levantarlo con el siguiente comando:
    ```
    docker run -d --name nats-server -p 4222:4222 -p 8222:8222 nats
    ```
    - Si el contenedor está creado pero no está en ejecución, levantarlo con el siguiente comando:
    ```
    docker start nats-server
    ```
5. Levantar base de datos de desarrollo con el comando `docker compose up -d`
6. Ejecutar migraciones de base de datos `npx prisma migrate dev`
7. Iniciar la aplicación `npm run start:dev`
