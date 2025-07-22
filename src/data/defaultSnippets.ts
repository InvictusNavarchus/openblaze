import { Snippet } from '../types';
import { generateId } from '../utils';

export const DEFAULT_SNIPPETS: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    shortcut: 'addr',
    name: 'My Address',
    content: '123 Main Street\nAnytown, ST 12345\nUnited States',
    description: 'My home address',
    folder: undefined,
    tags: ['personal', 'address'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: false,
    variables: []
  },
  {
    shortcut: 'email',
    name: 'Professional Email',
    content: 'john.doe@example.com',
    description: 'My professional email address',
    folder: undefined,
    tags: ['personal', 'email'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: false,
    variables: []
  },
  {
    shortcut: 'phone',
    name: 'Phone Number',
    content: '+1 (555) 123-4567',
    description: 'My phone number',
    folder: undefined,
    tags: ['personal', 'phone'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: false,
    variables: []
  },
  {
    shortcut: 'sig',
    name: 'Email Signature',
    content: 'Best regards,\nJohn Doe\nSoftware Developer\nExample Company\njohn.doe@example.com\n+1 (555) 123-4567',
    description: 'Professional email signature',
    folder: undefined,
    tags: ['email', 'signature', 'professional'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: false,
    variables: []
  },
  {
    shortcut: 'meeting',
    name: 'Meeting Request',
    content: 'Hi there,\n\nI hope this email finds you well. I would like to schedule a meeting to discuss our upcoming project.\n\nWould you be available for a 30-minute call sometime next week? Please let me know what times work best for you.\n\nLooking forward to hearing from you.\n\nBest regards,\nJohn Doe',
    description: 'Template for meeting requests',
    folder: undefined,
    tags: ['email', 'meeting', 'professional'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: false,
    variables: []
  },
  {
    shortcut: 'thanks',
    name: 'Thank You',
    content: 'Thank you for your time and consideration. I appreciate your help with this matter.',
    description: 'Polite thank you message',
    folder: undefined,
    tags: ['polite', 'thanks'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: false,
    variables: []
  },
  {
    shortcut: 'date',
    name: 'Current Date',
    content: '{date}',
    description: 'Insert current date',
    folder: undefined,
    tags: ['date', 'time'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: true,
    variables: []
  },
  {
    shortcut: 'time',
    name: 'Current Time',
    content: '{time}',
    description: 'Insert current time',
    folder: undefined,
    tags: ['date', 'time'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: true,
    variables: []
  },
  {
    shortcut: 'datetime',
    name: 'Current Date and Time',
    content: '{datetime}',
    description: 'Insert current date and time',
    folder: undefined,
    tags: ['date', 'time'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: true,
    variables: []
  },
  {
    shortcut: 'lorem',
    name: 'Lorem Ipsum',
    content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    description: 'Lorem ipsum placeholder text',
    folder: undefined,
    tags: ['placeholder', 'text'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: false,
    variables: []
  },
  {
    shortcut: 'br',
    name: 'Best Regards',
    content: 'Best regards,\n{name}',
    description: 'Professional closing with name variable',
    folder: undefined,
    tags: ['email', 'closing'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: true,
    variables: [
      {
        name: 'name',
        type: 'text',
        label: 'Your Name',
        defaultValue: 'John Doe',
        required: true
      }
    ]
  },
  {
    shortcut: 'intro',
    name: 'Introduction',
    content: 'Hi {name},\n\nI hope this message finds you well. My name is {myname} and I am reaching out regarding {topic}.',
    description: 'Professional introduction template',
    folder: undefined,
    tags: ['email', 'introduction'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: true,
    variables: [
      {
        name: 'name',
        type: 'text',
        label: 'Recipient Name',
        defaultValue: '',
        required: true
      },
      {
        name: 'myname',
        type: 'text',
        label: 'Your Name',
        defaultValue: 'John Doe',
        required: true
      },
      {
        name: 'topic',
        type: 'text',
        label: 'Topic',
        defaultValue: '',
        required: true
      }
    ]
  },
  {
    shortcut: 'followup',
    name: 'Follow Up',
    content: 'Hi {name},\n\nI wanted to follow up on our previous conversation about {topic}. Do you have any updates or questions I can help with?\n\nPlease let me know if you need any additional information.\n\nBest regards,\n{myname}',
    description: 'Follow-up email template',
    folder: undefined,
    tags: ['email', 'followup'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: true,
    variables: [
      {
        name: 'name',
        type: 'text',
        label: 'Recipient Name',
        defaultValue: '',
        required: true
      },
      {
        name: 'topic',
        type: 'text',
        label: 'Topic',
        defaultValue: '',
        required: true
      },
      {
        name: 'myname',
        type: 'text',
        label: 'Your Name',
        defaultValue: 'John Doe',
        required: true
      }
    ]
  },
  {
    shortcut: 'apology',
    name: 'Apology',
    content: 'I apologize for the delay in getting back to you. I have been {reason} and wanted to give your message the attention it deserves.\n\nThank you for your patience.',
    description: 'Professional apology template',
    folder: undefined,
    tags: ['email', 'apology'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: true,
    variables: [
      {
        name: 'reason',
        type: 'select',
        label: 'Reason for delay',
        defaultValue: 'busy with other commitments',
        options: [
          'busy with other commitments',
          'out of the office',
          'dealing with urgent matters',
          'traveling',
          'in meetings'
        ],
        required: true
      }
    ]
  },
  {
    shortcut: 'ooo',
    name: 'Out of Office',
    content: 'Thank you for your email. I am currently out of the office from {startdate} to {enddate} with limited access to email.\n\nIf this is urgent, please contact {contact} at {contactemail}.\n\nI will respond to your message when I return.\n\nBest regards,\n{name}',
    description: 'Out of office auto-reply template',
    folder: undefined,
    tags: ['email', 'ooo', 'vacation'],
    isEnabled: true,
    usageCount: 0,
    isDynamic: true,
    variables: [
      {
        name: 'startdate',
        type: 'date',
        label: 'Start Date',
        defaultValue: '',
        required: true
      },
      {
        name: 'enddate',
        type: 'date',
        label: 'End Date',
        defaultValue: '',
        required: true
      },
      {
        name: 'contact',
        type: 'text',
        label: 'Emergency Contact Name',
        defaultValue: '',
        required: false
      },
      {
        name: 'contactemail',
        type: 'text',
        label: 'Emergency Contact Email',
        defaultValue: '',
        required: false
      },
      {
        name: 'name',
        type: 'text',
        label: 'Your Name',
        defaultValue: 'John Doe',
        required: true
      }
    ]
  }
];

export function createDefaultSnippets(): Snippet[] {
  const now = Date.now();
  
  return DEFAULT_SNIPPETS.map(snippet => ({
    ...snippet,
    id: generateId(),
    createdAt: now,
    updatedAt: now
  }));
}
