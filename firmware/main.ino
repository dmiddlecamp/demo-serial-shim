SYSTEM_THREAD(ENABLED);
SYSTEM_MODE(SEMI_AUTOMATIC);


#define UPDATE_DELAY 5000
#define PUBLISH_TOPIC "offline_test"
#define SERIAL_DELIMITER ":::"

#define BLINK_DELAY 1000

unsigned long last_publish = 0;
unsigned long last_blink = 0;
int counter = 0;
bool led_state = false;

void setup() {
    Serial.begin(9600);
    pinMode(D7, OUTPUT);

    Particle.connect();
}

void loop() {
    unsigned long now = millis();
    if ((now - last_publish) > UPDATE_DELAY) {
        last_publish = now;

        serialPublish(PUBLISH_TOPIC, String(counter++));
    }

    if ((now - last_blink) > BLINK_DELAY) {
        last_blink = now;

        blink();
    }
}

void blink() {
    led_state = !led_state;
    digitalWrite(D7, (led_state) ? HIGH : LOW);
}

void serialPublish(String topic, String body) {
    if (Particle.connected()) {
        Particle.publish(topic, body);
    }
    else {
        Serial.println(topic + SERIAL_DELIMITER + body);
    }
}