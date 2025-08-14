
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface WelcomeEmailProps {
  name: string;
  setupLink: string;
}

export const WelcomeEmail = ({ name, setupLink }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to Readify! Let&apos;s get your account set up.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to Readify</Heading>
        <Text style={text}>
          Hello {name},
        </Text>
        <Text style={text}>
          An administrator has created an account for you on Readify. To get started, you need to set up your username and password by clicking the link below.
        </Text>
        <Button
          style={button}
          href={setupLink}
        >
          Complete Account Setup
        </Button>
        <Text style={text}>
          If you did not request this email, you can safely ignore it. This setup link will expire in 24 hours.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmail;

const main = {
  backgroundColor: '#f6f9fc',
  padding: '10px 0',
};

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #f0f0f0',
  padding: '45px',
};

const h1 = {
  color: '#3F51B5',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
};

const text = {
  color: '#444',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '16px',
  lineHeight: '24px',
};

const button = {
  backgroundColor: '#3F51B5',
  borderRadius: '5px',
  color: '#fff',
  fontFamily: "'Inter', sans-serif",
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '100%',
  padding: '12px 20px',
};
